import { createElement } from 'react';
import { tasks } from '@trigger.dev/sdk';
import { sendEmail } from './resend';
import { triggerEmail } from './trigger-email';

jest.mock('./resend', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('@trigger.dev/sdk', () => ({
  tasks: {
    trigger: jest.fn(),
  },
}));

jest.mock('@react-email/render', () => ({
  render: jest.fn().mockResolvedValue('<html>rendered</html>'),
}));

const react = createElement('div');
const ORIGINAL_KEY = process.env.TRIGGER_SECRET_KEY;

beforeEach(() => {
  jest.clearAllMocks();
  (sendEmail as jest.Mock).mockResolvedValue({
    message: 'Email sent successfully',
    id: 're_direct_1',
  });
  (tasks.trigger as jest.Mock).mockResolvedValue({
    id: 'run_1',
    publicAccessToken: 'pat_1',
  });
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.TRIGGER_SECRET_KEY;
  } else {
    process.env.TRIGGER_SECRET_KEY = ORIGINAL_KEY;
  }
});

describe('triggerEmail', () => {
  describe('when TRIGGER_SECRET_KEY is not set (self-hosted)', () => {
    beforeEach(() => {
      delete process.env.TRIGGER_SECRET_KEY;
    });

    it('sends synchronously via Resend and does not call tasks.trigger', async () => {
      const result = await triggerEmail({
        to: 'user@example.com',
        subject: 'Login to Comp AI',
        react,
      });

      expect(sendEmail).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Login to Comp AI',
        react,
        marketing: undefined,
        system: undefined,
        cc: undefined,
        scheduledAt: undefined,
        attachments: undefined,
      });
      expect(tasks.trigger).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 're_direct_1' });
    });

    it('maps the trustPortal flag onto the system channel', async () => {
      await triggerEmail({
        to: 'user@example.com',
        subject: 'Access granted',
        react,
        trustPortal: true,
      });

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ system: true }),
      );
    });

    it('propagates Resend failures to the caller', async () => {
      (sendEmail as jest.Mock).mockRejectedValue(
        new Error('Resend not initialized - missing API key'),
      );

      await expect(
        triggerEmail({ to: 'u@e.com', subject: 's', react }),
      ).rejects.toThrow('Resend not initialized - missing API key');
    });
  });

  describe('when TRIGGER_SECRET_KEY is set', () => {
    beforeEach(() => {
      process.env.TRIGGER_SECRET_KEY = 'tr_test_key';
    });

    it('routes through the send-email Trigger task and does not call Resend', async () => {
      const result = await triggerEmail({
        to: 'user@example.com',
        subject: 'Login to Comp AI',
        react,
      });

      expect(tasks.trigger).toHaveBeenCalledWith('send-email', {
        to: 'user@example.com',
        subject: 'Login to Comp AI',
        html: '<html>rendered</html>',
        channel: 'default',
        cc: undefined,
        scheduledAt: undefined,
        attachments: undefined,
      });
      expect(sendEmail).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'run_1' });
    });
  });
});
