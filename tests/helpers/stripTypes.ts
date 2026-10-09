/**
 * Type-stripping for tests that execute real source blocks.
 *
 * These suites slice a `useCallback` block out of the live source file and run
 * it against a stubbed environment, so the block has to be transpiled first.
 * `typescript` no longer exposes a programmatic API as of v7 (the package only
 * ships the CLI), so Bun's built-in transpiler does the stripping instead.
 * It is a drop-in here: both only need TypeScript syntax removed, not emitted
 * types or a whole-program check.
 */

const transpiler = new Bun.Transpiler({ loader: 'ts' });

/** Strip TypeScript syntax so the result can be evaluated by `new Function`. */
export const stripTypes = (source: string): string => transpiler.transformSync(source);
