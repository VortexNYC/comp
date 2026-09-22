import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth
vi.mock('@/utils/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Mock the Trigger.dev SDK
vi.mock('@trigger.dev/sdk', () => ({
  runs: {
    retrieve: vi.fn(),
  },
}));

// Import after mocks are declared
import { GET } from './route';
import { auth } from '@/utils/auth';
import { runs } from '@trigger.dev/sdk';

const mockGetSession = vi.mocked(auth.api.getSession);
const mockRunsRetrieve = vi.mocked(runs.retrieve);

function createRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/tasks/run_123/status');
}

function createParams(taskId: string): { params: Promise<{ taskId: string }> } {
  return { params: Promise.resolve({ taskId }) };
}

describe('GET /api/tasks/[taskId]/status', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null as any);

    const response = await GET(createRequest(), createParams('run_123'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockRunsRetrieve).not.toHaveBeenCalled();
  });

  it('should return 401 when there is no active organization', async () => {
    mockGetSession.mockResolvedValue({
      session: { activeOrganizationId: null },
    } as any);

    const response = await GET(createRequest(), createParams('run_123'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 (not leaking existence) when the run belongs to another organization', async () => {
    mockGetSession.mockResolvedValue({
      session: { activeOrganizationId: 'org_mine' },
    } as any);
    mockRunsRetrieve.mockResolvedValue({
      status: 'COMPLETED',
      output: { secret: 'someone else policy' },
      error: undefined,
      tags: ['org_other'],
    } as any);

    const response = await GET(createRequest(), createParams('run_123'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Run not found');
    expect(data.output).toBeUndefined();
  });

  it('should return 404 when the run has no tags at all', async () => {
    mockGetSession.mockResolvedValue({
      session: { activeOrganizationId: 'org_mine' },
    } as any);
    mockRunsRetrieve.mockResolvedValue({
      status: 'COMPLETED',
      output: { secret: 'untagged run' },
      error: undefined,
      tags: [],
    } as any);

    const response = await GET(createRequest(), createParams('run_123'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Run not found');
  });

  it('should return the run status when the run is tagged with the caller organization', async () => {
    mockGetSession.mockResolvedValue({
      session: { activeOrganizationId: 'org_mine' },
    } as any);
    mockRunsRetrieve.mockResolvedValue({
      status: 'COMPLETED',
      output: { result: 'my own output' },
      error: undefined,
      tags: ['org_mine'],
    } as any);

    const response = await GET(createRequest(), createParams('run_123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('COMPLETED');
    expect(data.output).toEqual({ result: 'my own output' });
  });
});
