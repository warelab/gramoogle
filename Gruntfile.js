'use strict';

module.exports = function (grunt) {
  require('jit-grunt')(grunt);

  grunt.loadNpmTasks('grunt-jest');
  grunt.loadNpmTasks('grunt-jsxhint');

  grunt.initConfig({
    less: {
      development: {
        options: {
          compress: false,
          yuicompress: true,
          optimization: 2
        },
        files: {
          "build/style.css": "styles/main.less"
        }
      }
    },

    browserify: {
      options: {
        browserifyOptions: {
          debug: true
        },
        transform: ['reactify']
      },
      dev: {
        src: './index.js',
        dest: 'build/bundle.js'
      },
      production: {
        browserifyOptions: {
          debug: false
        },
        src: '<%= browserify.dev.src %>',
        dest: 'build/bundle.js'
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

    jshint: {
      all: ['Gruntfile.js', 'scripts/**/*'],
      options: {
        jshintrc: true,
        reporter: require('jshint-stylish')
      }
    }
  });

  grunt.registerTask('default', ['less', 'browserify:dev', 'watch']);
  grunt.registerTask('package', ['jest', 'less', 'browserify:production']);
};
