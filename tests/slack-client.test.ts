import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { SlackClient } from '../src/clients/slack-client';
import { SlackMessage } from '../src/types';

test('SlackClient › constructor › should throw an error if webhookUrl is empty', () => {
  try {
    new SlackClient('');
    assert.unreachable('should have thrown an error');
  } catch (e: any) {
    assert.instance(e, Error);
    assert.is(e.message, 'Slack webhook URL not found in environment variables');
  }
});

test('SlackClient › constructor › should not throw an error if webhookUrl is provided', () => {
  try {
    new SlackClient('http://fake-webhook.com');
  } catch (e) {
    assert.unreachable('should not have thrown an error');
  }
});

test('SlackClient › postMessage › should call fetch with correct arguments', async () => {
  let calledUrl = '';
  let calledOptions: any = {};
  const mockFetch = async (url: string, options: any) => {
    calledUrl = url;
    calledOptions = options;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => ''
    };
  };

  const client = new SlackClient('http://fake-webhook.com', mockFetch as any);
  const message: SlackMessage = {
    text: 'test message',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'test message',
        },
      },
    ],
  };
  await client.postMessage(message);

  assert.is(calledUrl, 'http://fake-webhook.com');
  assert.equal(calledOptions, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
});

test('SlackClient › postMessage › should throw an error if fetch response is not ok', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'error body'
    });

    const client = new SlackClient('http://fake-webhook.com', mockFetch as any);
    const message: SlackMessage = {
      text: 'test',
      blocks: [],
    };

    try {
      await client.postMessage(message);
      assert.unreachable('should have thrown an error');
    } catch (e: any) {
      assert.instance(e, Error);
      assert.match(e.message, 'Slack API error: 500 Internal Server Error');
    }
});

test('SlackClient › postMessage › should throw an error if fetch fails', async () => {
    const mockFetch = async () => {
      throw new Error('Network error');
    };

    const client = new SlackClient('http://fake-webhook.com', mockFetch as any);
    const message: SlackMessage = {
      text: 'test',
      blocks: [],
    };

    try {
      await client.postMessage(message);
      assert.unreachable('should have thrown an error');
    } catch (e: any) {
      assert.instance(e, Error);
      assert.match(e.message, 'Failed to post to Slack: Error: Network error');
    }
});

test.run();
