import babel from 'rollup-plugin-babel';
import cleanup from 'rollup-plugin-cleanup';
import { uglify } from 'rollup-plugin-uglify';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/bundle.umd.js',
    name: 'tamia',
    sourceMap: true,
    format: 'umd',
    exports: 'named',
  },
  plugins: [
    babel({
      exclude: 'node_modules/**',
      plugins: ['external-helpers']
    }),
    cleanup(),
    uglify(),
  ],
  onwarn
};

function onwarn(message) {
  const suppressed = [
    'UNRESOLVED_IMPORT',
    'THIS_IS_UNDEFINED'
  ];

  if (!suppressed.find(code => message.code === code)) {
    return console.warn(message.message);
  }
}
