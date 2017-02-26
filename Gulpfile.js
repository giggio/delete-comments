"use strict";
const gulp = require("gulp"),
    sourcemaps = require("gulp-sourcemaps"),
    debug = require("gulp-debug"),
    fs = require('fs'),
    path = require('path'),
    plumber = require('gulp-plumber'),
    mocha = require('gulp-mocha'),
    ts = require("gulp-typescript"),
    typescript = require("typescript"),
    { spawn } = require('child_process'),
    tslint = require('tslint'),
    gulpTslint = require('gulp-tslint'),
    watch = require('gulp-watch'),
    rimraf = require('rimraf'),
    gulpSequence = require('gulp-sequence');

gulp.task('watch', ['transpile'], () => {
    gulp.watch(["lib/**/*.ts", "test/**/*.ts"], ['transpile']);
});

gulp.task("transpile", () => transpile());
gulp.task("trans", ['transpile']);
gulp.task("retrans", gulpSequence(['clean', 'transpile']));
gulp.task("re", ['retrans']);

gulp.task("transpile:production", ["clean"], () => transpile({ target: 'ES2015' }));

gulp.task("autotest", () => {
    gulp.watch(["lib/**/*.ts", "test/**/*.ts"], ['test']);
});

gulp.task('test', gulpSequence('transpile', ["test:notranspile"]));

gulp.task("test:quick", ["test:notranspile"]);

gulp.task("test:notranspile", test);

function test(done) {
    return gulp.src('dist/test/**/*.spec.js', { read: false })
        .pipe(mocha({ reporter: 'spec', require: ['./dist/test/_specHelper.js'] }));
};

const tsProjectDefault = ts.createProject("tsconfig.json", { typescript: typescript, outDir: '' });
function transpile(opt) {
    let tsProject = opt
        ? ts.createProject("tsconfig.json", { target: opt.target, typescript: typescript, outDir: '' })
        : tsProjectDefault;
    return tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(plumber())
        .pipe(debug({ title: 'transpile' }))
        .pipe(tsProject()).js
        .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '..' }))
        .pipe(gulp.dest("dist"));
}

gulp.task('lint', () => {
    return gulp.src(['lib/**/*.ts', 'test/**/*.ts'], { base: '.' })
        .pipe(debug({ title: 'lint' }))
        .pipe(gulpTslint({ program: tslint.Linter.createProgram("./tsconfig.json"), configuration: './tslint.json' }))
        .pipe(gulpTslint.report());
});

gulp.task('clean', () => {
    rimraf.sync(path.resolve(__dirname, 'dist'));
});

gulp.task('ci:quick', gulpSequence('ci-build', 'ci-test:quick'));
gulp.task('ci:slow', ['ci-test:slow']);
gulp.task('ci-build', gulpSequence(['lint', 'transpile:production']));
gulp.task('ci-test:quick', ['test:quick']);

gulp.task("default", ['transpile']);