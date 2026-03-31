import { Buffer } from 'node:buffer';

import { describe, expect, test } from 'vitest';

import { ProxyValidationError } from '../../src/proxy/normalize.js';
import { normalizeVmessUri, parseVmessUri } from '../../src/proxy/vmess.js';

const createVmessUri = (payload: Record<string, string>): string => {
  return `vmess://${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')}`;
};

describe('normalizeVmessUri', () => {
  test('normalizes base64 JSON vmess input into a Mihomo-compatible proxy', () => {
    const uri = createVmessUri({
      v: '2',
      ps: 'Example',
      add: 'vmess.example.com',
      port: '443',
      id: 'd7baecff-1956-46ce-c89c-bd81098d7223',
      aid: '0',
      scy: 'auto',
      net: 'tcp',
      type: 'none',
      tls: 'tls',
      sni: 'cdn.example.com',
      fp: 'chrome',
      pbk: 'public-key',
    });

    expect(normalizeVmessUri(uri, { envId: '95830' })).toEqual({
      name: '830',
      type: 'vmess',
      server: 'vmess.example.com',
      port: 443,
      uuid: 'd7baecff-1956-46ce-c89c-bd81098d7223',
      alterId: 0,
      cipher: 'auto',
      tls: true,
      servername: 'cdn.example.com',
      'client-fingerprint': 'chrome',
      'reality-opts': {
        'public-key': 'public-key',
      },
      network: 'tcp',
      udp: true,
    });
  });

  test('rejects URL-form vmess input', () => {
    expect(() => parseVmessUri('vmess://d7baecff-1956-46ce-c89c-bd81098d7223@example.com:443?type=tcp')).toThrowError(
      new ProxyValidationError('unsupported vmess URI format: URL-form vmess:// links are not supported'),
    );
  });

  test('rejects bad base64 payloads', () => {
    expect(() => parseVmessUri('vmess://not-base64!!!')).toThrowError(
      new ProxyValidationError('vmess URI must contain base64-encoded JSON'),
    );
  });

  test('rejects unsupported fields and invalid values', () => {
    expect(() =>
      parseVmessUri(
        createVmessUri({
          add: 'vmess.example.com',
          port: '443',
          id: 'd7baecff-1956-46ce-c89c-bd81098d7223',
          net: 'ws',
        }),
      ),
    ).toThrowError(new ProxyValidationError('vmess field "net" must be "tcp"'));

    expect(() =>
      parseVmessUri(
        createVmessUri({
          add: 'vmess.example.com',
          port: '443',
          id: 'd7baecff-1956-46ce-c89c-bd81098d7223',
          net: 'tcp',
          extra: 'value',
        } as Record<string, string>),
      ),
    ).toThrowError(new ProxyValidationError('unsupported vmess field "extra"'));
  });
});
