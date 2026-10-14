import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const srcDir = join(process.cwd(), 'src');
const tokensFile = join(srcDir, 'styles', 'tokens.css');
const literalColour = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;

function stylesheets(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return stylesheets(path);
    return name.endsWith('.css') ? [path] : [];
  });
}

describe('colour tokens', () => {
  it('keeps literal colours in styles/tokens.css only', () => {
    const offenders = stylesheets(srcDir)
      .filter((file) => file !== tokensFile)
      .filter((file) => literalColour.test(readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')))
      .map((file) => relative(srcDir, file));

    expect(offenders).toEqual([]);
  });
});

describe('typography and breakpoints', () => {
  const allowedBreakpoints = new Set(['640', '899', '900', '1200']);
  // SVG ring text is sized in viewBox units, not CSS pixels.
  const svgTextExceptions = ['pages/ScorecardView.css: 8.5px'];
  const withoutComments = (file) => readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('keeps CSS font sizes at 12px or larger', () => {
    const offenders = stylesheets(srcDir).flatMap((file) => {
      const name = relative(srcDir, file);
      return [...withoutComments(file).matchAll(/font-size:\s*(\d*\.?\d+)px/g)]
        .filter((match) => Number(match[1]) < 12)
        .map((match) => `${name}: ${match[1]}px`)
        .filter((entry) => !svgTextExceptions.includes(entry));
    });

    expect(offenders).toEqual([]);
  });

  it('uses only the shared breakpoints', () => {
    const offenders = stylesheets(srcDir).flatMap((file) =>
      [...withoutComments(file).matchAll(/@media[^{]*/g)]
        .flatMap((match) => [...match[0].matchAll(/(\d+)px/g)].map((px) => px[1]))
        .filter((px) => !allowedBreakpoints.has(px))
        .map((px) => `${relative(srcDir, file)}: ${px}px`));

    expect(offenders).toEqual([]);
  });

  it('takes transition timing from the motion tokens', () => {
    // The reading-progress bar ticks continuously, so it keeps its own linear timing.
    const exceptions = ['pages/Notes.css: width 0.12s linear'];
    const offenders = stylesheets(srcDir)
      .filter((file) => file !== tokensFile)
      .flatMap((file) =>
        [...withoutComments(file).matchAll(/(?<![-\w])transition:\s*([^;]+);/g)]
          .map((match) => match[1].trim())
          .filter((value) => /\d(\.\d+)?m?s\b/.test(value))
          .map((value) => `${relative(srcDir, file)}: ${value}`))
      .filter((entry) => !exceptions.includes(entry));

    expect(offenders).toEqual([]);
  });
});
