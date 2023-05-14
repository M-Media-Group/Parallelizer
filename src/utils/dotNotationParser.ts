export default function dotNotationParser(obj: any, path: string) {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        result = result[key];
    }
    return result;
}
