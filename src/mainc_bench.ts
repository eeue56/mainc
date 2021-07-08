export function benchQuickTest() {
    const a = 1;
    const b = 2;
    const c = a + b;
}

export function benchSlowTest() {
    let a = 0;

    for (var i = 0; i < 1000000; i++) {
        a += 1;
    }
}

export function benchReallSlowTest() {
    let a = 0;

    for (var i = 0; i < 100000000; i++) {
        a += 1;
    }
}

export async function benchAsyncQuickTest() {
    const a = 1;
    const b = 2;
    const c = a + b;
}

export async function benchAsyncSlowTest() {
    return new Promise((resolve) => {
        setTimeout(() => {
            const a = 1;
            resolve(null);
        }, 300);
    });
}

export async function benchAsyncReallSlowTest() {
    return new Promise((resolve) => {
        setTimeout(() => {
            const a = 1;
            resolve(null);
        }, 3000);
    });
}
