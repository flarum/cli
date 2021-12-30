module.exports = {
  presets: [
    '@babel/preset-env',
    { targets: { node: 'current' } },
  ],
  plugins: [
    [
      "module-resolver",
      {
        alias: {
          boilersmith: "./src/boilersmith"
        }
      }
    ]
  ]
};
