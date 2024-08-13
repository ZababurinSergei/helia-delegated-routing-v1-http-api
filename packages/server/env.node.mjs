import { readFile } from 'fs/promises';

let ENV = {}

try {
    const json = JSON.parse(
        await readFile(
            new URL('./docs/env.json', import.meta.url)
        )
    );

    ENV = json
} catch (e) {
    console.error('ERROR FETCH JSON', e)
}

// console.log('ENV', ENV)
export const env = (props) => {

    return ENV
}