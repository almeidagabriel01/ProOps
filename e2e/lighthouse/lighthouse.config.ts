const config = {
  ci: {
    collect: {
      url: ['http://localhost:3000/login'],
      numberOfRuns: 1,
      settings: {
        chromeFlags: ['--headless', '--no-sandbox'],
        onlyCategories: ['performance', 'accessibility', 'best-practices'],
      },
    },
    assert: {
      assertions: {
        'first-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lighthouse-report',
    },
  },
};

export default config;
