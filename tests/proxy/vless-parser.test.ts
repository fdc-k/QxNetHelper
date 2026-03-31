import { describe, expect, test } from 'vitest';

import { ProxyValidationError } from '../../src/proxy/normalize.js';
import { normalizeVlessUri, parseVlessUri } from '../../src/proxy/vless.js';

const SAMPLE_VLESS_URL =
  'vless://d7baecff-1956-46ce-c89c-bd81098d7223@zdegeuy2.bia3.top:21375?encryption=none&flow=xtls-rprx-vision&security=reality&sni=ndl.certainteed.com&fp=chrome&pbk=W9BjX6YmCIVsjhKMlz233Yoe0xcf0SVHfvPKqbf3vCg&type=tcp&headerType=none#A8320-%E5%BE%B7%E5%9B%BD-sing1';

describe('normalizeVlessUri', () => {
  test('normalizes the plan sample into a Mihomo-compatible VLESS proxy', () => {
    expect(normalizeVlessUri(SAMPLE_VLESS_URL, { envId: '95830' })).toEqual({
      name: '830',
      type: 'vless',
      server: 'zdegeuy2.bia3.top',
      port: 21375,
      uuid: 'd7baecff-1956-46ce-c89c-bd81098d7223',
      flow: 'xtls-rprx-vision',
      tls: true,
      servername: 'ndl.certainteed.com',
      'client-fingerprint': 'chrome',
      'reality-opts': {
        'public-key': 'W9BjX6YmCIVsjhKMlz233Yoe0xcf0SVHfvPKqbf3vCg',
      },
      network: 'tcp',
      udp: true,
    });
  });

  test('rejects duplicate query parameters', () => {
    expect(() =>
      parseVlessUri(
        'vless://d7baecff-1956-46ce-c89c-bd81098d7223@example.com:443?encryption=none&security=tls&security=reality&type=tcp',
      ),
    ).toThrowError(new ProxyValidationError('duplicate query parameter "security" is not allowed'));
  });

  test('rejects malformed percent encoding', () => {
    expect(() =>
      parseVlessUri(
        'vless://d7baecff-1956-46ce-c89c-bd81098d7223@example.com:443?encryption=none&security=reality&sni=bad%ZZ&fp=chrome&pbk=public&type=tcp',
      ),
    ).toThrowError(new ProxyValidationError('query parameter "sni" contains malformed percent-encoding'));
  });

  test('rejects invalid UUID and invalid port', () => {
    expect(() =>
      parseVlessUri('vless://not-a-uuid@example.com:443?encryption=none&security=tls&type=tcp'),
    ).toThrowError(new ProxyValidationError('uuid must be a valid UUID'));

    expect(() =>
      parseVlessUri(
        'vless://d7baecff-1956-46ce-c89c-bd81098d7223@example.com:70000?encryption=none&security=tls&type=tcp',
      ),
    ).toThrowError(new ProxyValidationError('port must be a valid integer between 1 and 65535'));
  });

  test('rejects unknown query parameters and duplicate normalized names', () => {
    expect(() =>
      parseVlessUri(
        'vless://d7baecff-1956-46ce-c89c-bd81098d7223@example.com:443?encryption=none&security=tls&type=tcp&extra=value',
      ),
    ).toThrowError(new ProxyValidationError('unsupported query parameter "extra"'));

    expect(() => normalizeVlessUri(SAMPLE_VLESS_URL, { envId: '95830', existingNames: ['830'] })).toThrowError(
      new ProxyValidationError('duplicate proxy name "830" is not allowed'),
    );
  });
});
