'use strict';

module.exports = function (grunt) {
  require('jit-grunt')(grunt);
  require('matchdep').filterAll('grunt-*').forEach(grunt.loadNpmTasks);

  var lessifyOptions = {
    plugins: [
      new (require('less-plugin-autoprefix'))({browsers: ["last 2 versions"]})
    ]
  };

  grunt.initConfig({
    flow: {
      options: {
        style: 'color'
      }
    },

    browserify: {
      dev: {
        options: {
          browserifyOptions: {
            debug: true
          },
          transform: [
            ['node-lessify', lessifyOptions],
            ['babelify']
          ]
        },
        src: './index.js',
        dest: 'build/bundle.js'
      },
      production: {
        options: {
          transform: [
            ['node-lessify', lessifyOptions],
            ['babelify'],
            ['uglifyify', {global: true}]
          ],
          browserifyOptions: {
            debug: false
          }
        },
        src: '<%= browserify.dev.src %>',
        dest: '<%= browserify.dev.dest %>'
      }
    },

    watch: {
      browserify: {
        files: ['scripts/**/*', 'styles/*.less'],
        tasks: ['browserify:dev']
      }
    },

    jest: {
      options: {
        coverage: false,
        config: './jest.config.json'
      }
    },

    jasmine_node: {
      options: {
        forceExit: true,
        match: '.',
        matchall: false,
        extensions: 'js',
        specNameMatcher: 'spec'
      },
      all: ['spec/']
    }
  });

  grunt.registerTask('test', ['jasmine_node']);
  grunt.registerTask('default', ['browserify:dev', 'watch']);
  grunt.registerTask('package', ['browserify:production', 'test']);
};
