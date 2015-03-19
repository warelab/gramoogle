var gulp = require('gulp');
var gutil = require('gulp-util');
var sourcemaps = require('gulp-sourcemaps');
var jshint = require('gulp-jshint');
var browserify = require('browserify');
var reactify = require('reactify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var watch = require('gulp-watch');
var batch = require('gulp-batch');
var debug = require('gulp-debug');
var jest = require('gulp-jest');

var paths = {
  styles: ['./styles/*.styl'],
  images: ['./images/*'],
  data: ['./data/*'],
  scripts: {
    index: './index.js',
    watchable: ["./index.js", "./scripts/**/*.js*"],
    browserify: ["./scripts/*.js*"],
    vendor: ["./scripts/vendor/*.js"]
  },
  lintables: [
    './index.js',
    "./scripts/*.js"
  ]
};

gulp.task('default', function() {
  console.log('hello world!');
});

gulp.task('lint', function() {
  gulp.src(paths.lintables)
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('browserify', function() {
  browserify({entries: paths.scripts.index, debug: true})
    .transform(reactify)
    .bundle()
    .on('error', gutil.log.bind(gutil, 'Browserify Error'))
    .pipe(source('bundle.js'))
    .pipe(debug({title: 'Bundling scripts:'}))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('build'));
});

gulp.task('test', function () {
  return gulp.src('__tests__')
    .pipe(jest({
      testDirectoryName: "__tests__",
      scriptPreprocessor: "../preprocessor.js",
      unmockedModulePathPatterns: [
        "node_modules/react",
        "node_modules/reflux"
      ],
      testPathIgnorePatterns: [
        "node_modules"
      ],
      moduleFileExtensions: [
        "js",
        "jsx",
        "json"
      ]
  }));
});

gulp.task('build', ['lint', 'test', 'browserify']);

gulp.task('watch', function() {
  watch(paths.scripts.watchable, batch(function () {
    gulp.start('build');
  }));
});

gulp.on('err', function(err) {
  console.log(err);
});