module.exports = {
  presets: ['@babel/preset-env'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          boilersmith: './src/boilersmith',
        },
      },
    ],
  ],
};
