import { describe, expect, test } from 'vitest';

import { getConfigTimezone, getNextConfigFileName, parseConfigFileName, selectLatestConfigFile } from '../../src/yaml/configFiles.js';

describe('parseConfigFileName', () => {
  test('rejects invalid file names', () => {
    expect(parseConfigFileName('config_13AA.yaml')).toBeNull();
    expect(parseConfigFileName('config_0230.yaml')).toBeNull();
  });
});

describe('selectLatestConfigFile', () => {
  test('uses Asia/Shanghai calendar rules across year rollover', () => {
    const files = [
      { name: 'config_1231.yaml', fileToken: 'older' },
      { name: 'config_0101.yaml', fileToken: 'newer' },
    ];

    expect(selectLatestConfigFile(files, new Date('2026-01-01T00:30:00+08:00'))).toEqual({
      name: 'config_0101.yaml',
      fileToken: 'newer',
    });
  });

  test('picks the highest same-day suffix before modified time tie-breakers', () => {
    const files = [
      { name: 'config_0331_1.yaml', modifiedTime: '2026-03-31T02:00:00Z', fileToken: 'a' },
      { name: 'config_0331_2.yaml', modifiedTime: '2026-03-31T01:00:00Z', fileToken: 'b' },
      { name: 'config_0331.yaml', modifiedTime: '2026-03-31T03:00:00Z', fileToken: 'c' },
    ];

    expect(selectLatestConfigFile(files, new Date('2026-03-31T12:00:00+08:00'))).toEqual(files[1]);
  });

  test('ignores non-matching names and returns null when none match', () => {
    expect(selectLatestConfigFile([{ name: 'notes.txt' }, { name: 'config_latest.yaml' }])).toBeNull();
  });

  test('uses modified time and file token for deterministic ties', () => {
    const files = [
      { name: 'config_0331.yaml', modifiedTime: '2026-03-31T01:00:00Z', fileToken: 'a' },
      { name: 'config_0331.yaml', modifiedTime: '2026-03-31T01:00:00Z', fileToken: 'b' },
    ];

    expect(selectLatestConfigFile(files, new Date('2026-03-31T12:00:00+08:00'))).toEqual(files[1]);
  });
});

describe('getNextConfigFileName', () => {
  test('returns the base filename first for today', () => {
    expect(getNextConfigFileName([], new Date('2026-03-31T09:00:00+08:00'))).toBe('config_0331.yaml');
  });

  test('increments same-day suffixes for today', () => {
    const files = [
      { name: 'config_0331.yaml' },
      { name: 'config_0331_1.yaml' },
      { name: 'config_0330_9.yaml' },
    ];

    expect(getNextConfigFileName(files, new Date('2026-03-31T09:00:00+08:00'))).toBe('config_0331_2.yaml');
  });
});

describe('getConfigTimezone', () => {
  test('exposes the locked config timezone', () => {
    expect(getConfigTimezone()).toBe('Asia/Shanghai');
  });
});
