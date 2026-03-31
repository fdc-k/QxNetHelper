import process from 'node:process';

export const getFeishuBaseUrl = (): string | undefined => {
  const value = process.env.QXNETHELPER_FEISHU_BASE_URL?.trim();

  return value && value.length > 0 ? value : undefined;
};
