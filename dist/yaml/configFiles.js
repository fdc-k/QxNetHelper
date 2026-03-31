const CONFIG_TIMEZONE = 'Asia/Shanghai';
const CONFIG_FILE_NAME_PATTERN = /^config_(\d{2})(\d{2})(?:_(\d+))?\.ya?ml$/iu;
const shanghaiDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CONFIG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});
const toShanghaiDateParts = (date) => {
    const parts = shanghaiDateFormatter.formatToParts(date);
    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);
    return { year, month, day };
};
const isLeapYear = (year) => {
    return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
};
const getDaysInMonth = (year, month) => {
    if (month === 2) {
        return isLeapYear(year) ? 29 : 28;
    }
    return [4, 6, 9, 11].includes(month) ? 30 : 31;
};
const isValidMonthDay = (year, month, day) => {
    return month >= 1 && month <= 12 && day >= 1 && day <= getDaysInMonth(year, month);
};
const inferEffectiveYear = (parsedName, referenceDate) => {
    const sameOrEarlierInYear = parsedName.month < referenceDate.month
        || (parsedName.month === referenceDate.month && parsedName.day <= referenceDate.day);
    return sameOrEarlierInYear ? referenceDate.year : referenceDate.year - 1;
};
const toSortableTimestamp = (value) => {
    if (!value) {
        return Number.NEGATIVE_INFINITY;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
};
const compareConfigFiles = (left, right) => {
    if (left.effectiveYear !== right.effectiveYear) {
        return left.effectiveYear - right.effectiveYear;
    }
    if (left.parsedName.month !== right.parsedName.month) {
        return left.parsedName.month - right.parsedName.month;
    }
    if (left.parsedName.day !== right.parsedName.day) {
        return left.parsedName.day - right.parsedName.day;
    }
    if (left.parsedName.sequence !== right.parsedName.sequence) {
        return left.parsedName.sequence - right.parsedName.sequence;
    }
    const modifiedTimeDelta = toSortableTimestamp(left.file.modifiedTime) - toSortableTimestamp(right.file.modifiedTime);
    if (modifiedTimeDelta !== 0) {
        return modifiedTimeDelta;
    }
    const fileTokenDelta = (left.file.fileToken ?? '').localeCompare(right.file.fileToken ?? '');
    if (fileTokenDelta !== 0) {
        return fileTokenDelta;
    }
    return left.file.name.localeCompare(right.file.name);
};
export const parseConfigFileName = (fileName) => {
    const match = CONFIG_FILE_NAME_PATTERN.exec(fileName);
    if (!match) {
        return null;
    }
    const month = Number(match[1]);
    const day = Number(match[2]);
    if (!isValidMonthDay(2024, month, day)) {
        return null;
    }
    return {
        name: fileName,
        month,
        day,
        sequence: match[3] === undefined ? 0 : Number(match[3]),
        extension: fileName.endsWith('.yml') ? 'yml' : 'yaml',
    };
};
export const selectLatestConfigFile = (files, now = new Date()) => {
    const referenceDate = toShanghaiDateParts(now);
    const candidates = files.flatMap((file) => {
        const parsedName = parseConfigFileName(file.name);
        if (!parsedName) {
            return [];
        }
        return [{
                file,
                parsedName,
                effectiveYear: inferEffectiveYear(parsedName, referenceDate),
            }];
    });
    candidates.sort(compareConfigFiles);
    return candidates.at(-1)?.file ?? null;
};
export const getNextConfigFileName = (files, now = new Date()) => {
    const referenceDate = toShanghaiDateParts(now);
    const todaySequence = files.reduce((highestSequence, file) => {
        const parsedName = parseConfigFileName(file.name);
        if (!parsedName) {
            return highestSequence;
        }
        if (parsedName.month !== referenceDate.month || parsedName.day !== referenceDate.day) {
            return highestSequence;
        }
        return Math.max(highestSequence, parsedName.sequence);
    }, -1);
    const dateSlug = `${String(referenceDate.month).padStart(2, '0')}${String(referenceDate.day).padStart(2, '0')}`;
    if (todaySequence < 0) {
        return `config_${dateSlug}.yaml`;
    }
    return `config_${dateSlug}_${todaySequence + 1}.yaml`;
};
export const getConfigTimezone = () => {
    return CONFIG_TIMEZONE;
};
//# sourceMappingURL=configFiles.js.map