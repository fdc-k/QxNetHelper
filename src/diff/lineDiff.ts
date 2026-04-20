export const generateLineDiff = (original: string, modified: string): string => {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const diff: string[] = [];

  let i = 0;
  let j = 0;

  while (i < originalLines.length || j < modifiedLines.length) {
    if (i < originalLines.length && j < modifiedLines.length && originalLines[i] === modifiedLines[j]) {
      i++;
      j++;
    } else {
      const nextI = originalLines.indexOf(modifiedLines[j], i);
      const nextJ = modifiedLines.indexOf(originalLines[i], j);

      if (nextI !== -1 && (nextJ === -1 || nextI - i < nextJ - j)) {
        while (i < nextI) {
          diff.push('- ' + originalLines[i]);
          i++;
        }
      } else if (nextJ !== -1) {
        while (j < nextJ) {
          diff.push('+ ' + modifiedLines[j]);
          j++;
        }
      } else {
        if (i < originalLines.length) {
          diff.push('- ' + originalLines[i]);
          i++;
        }
        if (j < modifiedLines.length) {
          diff.push('+ ' + modifiedLines[j]);
          j++;
        }
      }
    }
  }

  return diff.join('\n');
};
