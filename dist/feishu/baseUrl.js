import process from 'node:process';
export const getFeishuBaseUrl = () => {
    const value = process.env.QXNETHELPER_FEISHU_BASE_URL?.trim();
    return value && value.length > 0 ? value : undefined;
};
//# sourceMappingURL=baseUrl.js.map