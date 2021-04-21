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

function main(params) {
    Potrace.loadImageFromUrl("../Potrace.png");
    Potrace.process(function () {
        let svg = getSVGWithFilter(1, "curve", 10);
        // console.log(svg);
        document.body.appendChild(Potrace.img);
        document.body.insertAdjacentHTML("beforeend", '<br>' + svg);
        console.log(document.body.children[document.body.children.length - 1]);
    });
}

export { main };