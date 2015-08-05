'use strict';

module.exports = function (grunt) {
  require('jit-grunt')(grunt);

  require('matchdep').filterAll('grunt-*').forEach(grunt.loadNpmTasks);

  grunt.initConfig({
    less: {
      development: {
        options: {
          compress: false,
          yuicompress: true,
          optimization: 2,
          sourceMap: true,
          sourceMapFileInline: true
        },
        plugins: [
          new (require('less-plugin-autoprefix'))({browsers: ["last 2 versions"]})
        ],
        files: {
          "build/style.css": "styles/main.less"
        }
      }
    },

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
            ['babelify']
          ]
        },
        src: './index.js',
        dest: 'build/bundle.js'
      },
      production: {
        options: {
          transform: [
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
      styles: {
        files: ['styles/*.less'],
        tasks: ['less'],
        options: {
          nospawn: true
        }
      },

      browserify: {
        files: 'scripts/**/*',
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
    },

    jshint: {
      all: ['Gruntfile.js', 'scripts/**/*'],
      options: {
        jshintrc: true,
        reporter: require('jshint-stylish')
      }
    }
  });

  grunt.registerTask('test', ['jasmine_node']);
  grunt.registerTask('default', ['less', 'browserify:dev', 'watch']);
  grunt.registerTask('package', ['less', 'browserify:production', 'test']);
};
