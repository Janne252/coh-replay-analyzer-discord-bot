export function makeLength(template: string, maxLength: number) {
    const part = `${template} `;
    return part.repeat(Math.ceil(maxLength / part.length)).substring(0, maxLength);
}
