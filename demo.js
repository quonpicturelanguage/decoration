import { Bezier } from './third-party-library/bezierjs/bezier.js';
import { Potrace } from './third-party-library/potrace/potrace.js';
globalThis.Bezier = Bezier;
globalThis.Potrace = Potrace;

function getSVGWithFilter(size, opt_type, length_filter) {

    var { bm, pathlist } = Potrace.getVars();

    function getSVG(size, opt_type) {

        function path(curve) {

            function bezier(i) {
                var b = 'C ' + (curve.c[i * 3 + 0].x * size).toFixed(3) + ' ' +
                    (curve.c[i * 3 + 0].y * size).toFixed(3) + ',';
                b += (curve.c[i * 3 + 1].x * size).toFixed(3) + ' ' +
                    (curve.c[i * 3 + 1].y * size).toFixed(3) + ',';
                b += (curve.c[i * 3 + 2].x * size).toFixed(3) + ' ' +
                    (curve.c[i * 3 + 2].y * size).toFixed(3) + ' ';
                return b;
            }

            function segment(i) {
                var s = 'L ' + (curve.c[i * 3 + 1].x * size).toFixed(3) + ' ' +
                    (curve.c[i * 3 + 1].y * size).toFixed(3) + ' ';
                s += (curve.c[i * 3 + 2].x * size).toFixed(3) + ' ' +
                    (curve.c[i * 3 + 2].y * size).toFixed(3) + ' ';
                return s;
            }

            var n = curve.n, i;
            var p = 'M' + (curve.c[(n - 1) * 3 + 2].x * size).toFixed(3) +
                ' ' + (curve.c[(n - 1) * 3 + 2].y * size).toFixed(3) + ' ';
            for (i = 0; i < n; i++) {
                if (curve.tag[i] === "CURVE") {
                    p += bezier(i);
                } else if (curve.tag[i] === "CORNER") {
                    p += segment(i);
                }
            }
            //p += 
            return p;
        }

        var w = bm.w * size, h = bm.h * size,
            len = pathlist.length, c, i, strokec, fillc, fillrule;

        var svg = '<svg id="svg" version="1.1" width="' + w + '" height="' + h +
            '" xmlns="http://www.w3.org/2000/svg">';
        if (opt_type === "curve") {
            strokec = "black";
            fillc = "none";
            fillrule = '';
        } else {
            strokec = "none";
            fillc = "black";
            fillrule = ' fill-rule="evenodd"';
        }
        for (i = 0; i < len; i++) {
            if (pathlist[i].len <= length_filter) continue;
            c = pathlist[i].curve;
            svg += '<path d="';
            svg += path(c);
            svg += '" stroke="' + strokec + '" fill="' + fillc + '"' + fillrule + '/>';
        }

        svg += '</svg>';
        return svg;
    }
    return getSVG(size, opt_type);
}

function getBezierList(length_filter) {

    let size = 1;
    let opt_type = "curve";

    var { pathlist } = Potrace.getVars();

    function getList(size, opt_type) {

        function path(curve) {

            function LineTo(p0, p2, size) {
                let p1 = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
                return new Bezier(
                    p0.x * size, p0.y * size,
                    p1.x * size, p1.y * size,
                    p2.x * size, p2.y * size,
                );
            }

            function bezier(i) {
                let list = [new Bezier(
                    lastPoint.p.x, lastPoint.p.y,
                    curve.c[i * 3 + 0].x * size, curve.c[i * 3 + 0].y * size,
                    curve.c[i * 3 + 1].x * size, curve.c[i * 3 + 1].y * size,
                    curve.c[i * 3 + 2].x * size, curve.c[i * 3 + 2].y * size,
                )];
                lastPoint.p = curve.c[i * 3 + 2];
                return list;
            }

            function segment(i) {
                let list = [
                    LineTo(lastPoint.p, curve.c[i * 3 + 1], size),
                    LineTo(curve.c[i * 3 + 1], curve.c[i * 3 + 2], size),
                ];
                lastPoint.p = curve.c[i * 3 + 2];
                return list;
            }

            var n = curve.n, i;
            var lastPoint = { p: curve.c[(n - 1) * 3 + 2] };
            var p = [];
            for (i = 0; i < n; i++) {
                if (curve.tag[i] === "CURVE") {
                    p = p.concat(bezier(i));
                } else if (curve.tag[i] === "CORNER") {
                    p = p.concat(segment(i));
                }
            }
            return p;
        }

        var len = pathlist.length, c, i;

        var lines = [];

        for (i = 0; i < len; i++) {
            if (pathlist[i].len <= length_filter) continue;
            c = pathlist[i].curve;
            lines.push(new CombineLine(path(c), pathlist[i].sign == '+'));
        }

        return lines;
    }
    return getList(size, opt_type);
}

class CombineLine {
    constructor(BezierList, sign) {
        this.BezierList = BezierList;
        this.sign = sign;
        this.lengths = BezierList.map(v => v.length());
        this.length = this.lengths.reduce((a, b) => a + b);
        this.size = BezierList.length;
    }

    offset(t, d) {
        if (t < 0 || t > 1) {
            throw 't<0||t>1';
        }
        let len = this.length * t;
        for (let index = 0; index < this.size; index++) {
            const leni = this.lengths[index];
            if (len > leni) {
                len -= leni;
            } else {
                return this.BezierList[index].offset(len / leni, d * (this.sign ? 1 : -1));
            }
        }
        throw 'should not happen';
    }
}

function main(params) {
    Potrace.loadImageFromUrl("../Potrace.png");
    Potrace.process(function () {
        let length_filter = 10;
        let svg = getSVGWithFilter(1, "curve", length_filter);
        // console.log(svg);
        document.body.appendChild(Potrace.img);
        document.body.insertAdjacentHTML("beforeend", '<br>' + svg);
        console.log(document.body.children[document.body.children.length - 1]);

        let lines = getBezierList(length_filter);
        globalThis.lines = lines;
        console.log(lines);
    });
}

export { main };