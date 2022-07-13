import { Bezier } from './third-party-library/bezierjs/bezier.js';
import { Potrace } from './third-party-library/potrace/potrace.js';
import * as util from './util.js';

const flagDebug = true;

if (flagDebug) {
    globalThis.Bezier = Bezier;
    globalThis.Potrace = Potrace;
    globalThis.util = util;
}

/** @type {import('../visualtool/src/main.js').QVT}*/
const { QVT } = globalThis.exports;
const { CircuitNode, PictureLine } = QVT.prototype;


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
        let eps = 1e-8;
        if (t < 0 && t > -eps) t = 0;
        if (t > 1 && t < 1 + eps) t = 1;
        if (t < 0 || t > 1) {
            throw 't<0||t>1 : t= ' + t;
        }
        let len = this.length * t;
        for (let index = 0; index < this.size; index++) {
            const leni = this.lengths[index];
            if (Math.abs(len - leni) <= eps) {
                len = leni;
            }
            if (len > leni) {
                len -= leni;
            } else {
                return this.BezierList[index].offset(len / leni, d * (this.sign ? 1 : -1));
            }
        }
        console.log(this.length, len, this.lengths[this.size - 1]);
        throw 'should not happen';
    }
}

function testDraw(funcList) {
    let n = 100;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    let paths = [];
    funcList.forEach(func => {

        let pts = [...Array(n + 1)].map((v, i) => func(i / n));
        pts.forEach(p => {
            minx = Math.min(minx, p.x);
            miny = Math.min(miny, p.y);
            maxx = Math.max(maxx, p.x);
            maxy = Math.max(maxy, p.y);
        })
        let path = [];
        path.push('M' + (pts[0].x).toFixed(3) + ' ' + (pts[0].y).toFixed(3) + ' ');
        for (let index = 1; index <= n; index++) {
            path.push('L' + (pts[index].x).toFixed(3) + ' ' + (pts[index].y).toFixed(3) + ' ');
        }
        paths.push(path);
    })

    let w = maxx + 100, h = maxy + 100;
    var svg = '<svg id="svg" version="1.1" width="' + w + '" height="' + h +
        '" xmlns="http://www.w3.org/2000/svg">';

    var strokec = "black";
    var fillc = "none";
    var fillrule = '';

    paths.forEach(path => {
        svg += '<path d="';
        svg += path.join(' ');
        svg += '" stroke="' + strokec + '" fill="' + fillc + '"' + fillrule + '/>';
    })

    svg += '</svg>';
    return { svg, paths, minx, miny, maxx, maxy };
}

const QVTGConfig = {
    qubit_number: 1,
    gate_length: 7,
    gate_count_plus: 2,
    arg_extra: 0.13,
    svg_position_ratio: 20,
    svg_size_ratio: 20,
    line_width_ratio: 4.8,
    disable_connecting_cz: true,
    frontlineWidth: 6,
    backlineWidth: 14,
    chargeRadiusPlus: 6,
}

const QVTGConfig_Default = Object.assign({}, QVTGConfig)
function resetQVTGConfig() {
    Object.assign(QVTGConfig, QVTGConfig_Default)
}

function testDrawQVT(line) {
    // 356 ~ 37
    // let totalDepth = 37;
    let totalDepth = Math.ceil(line.length / QVTGConfig.gate_length) + QVTGConfig.gate_count_plus;
    let totalBits = QVTGConfig.qubit_number;
    let stringsrc = generateRandomCircuit(totalBits, totalDepth).map(v => v.join(',')).join('\n')
    const argExtra = QVTGConfig.arg_extra;
    CircuitNode.prototype.LineArgument = {
        parallelPositive: argExtra,
        parallelNegativeNormal: argExtra,
        parallelNegativeSmall: argExtra,
        parallelNegativeBig: argExtra,
    }
    QVT.prototype.frontlineWidth = QVTGConfig.frontlineWidth
    QVT.prototype.backlineWidth = QVTGConfig.backlineWidth
    QVT.prototype.chargeRadiusPlus = QVTGConfig.chargeRadiusPlus
    CircuitNode.prototype.calculatePosition = function (deep, bitIndex, positionIndex) {
        let { x, y } = line.offset(deep / totalDepth, ((bitIndex - (totalBits - 1) / 2) * 0.65 + (positionIndex - 2.5) * 0.5 / 3) * QVTGConfig.line_width_ratio);
        return [x, y];
    }
    PictureLine.prototype.calculateSVGPosition = function (position) {
        return position.map(v => QVTGConfig.svg_position_ratio * v)
    }
    let getSVGLineData = (pl) => {
        let lineData;// = this.Line[this.type](this.args)
        let SVGLineData;// = lineData.map(v => [v[0], v.slice(1).map(v => this.calculateSVGPosition(this.combine(v)))])

        let node1 = pl.node1;
        let node2 = pl.node2;
        let index1 = pl.rawArg[1];
        let index2 = pl.rawArg[2].targetIndex;
        // only consider ring now
        const getExtraPoint = (node, index) => {
            let ndeep;
            if (pl.qvt.util.lp(index)) {
                ndeep = node.deep - 1
            } else {
                ndeep = node.deep + 1
            }
            ndeep = (ndeep + pl.qvt.gateArray.length) % pl.qvt.gateArray.length
            let nnode = pl.qvt.nodeNet[pl.qvt.util.di2s(ndeep, node.bitIndex)]
            return nnode.position[index]
        }
        let sourcePosition = pl.sourcePosition.concat([getExtraPoint(node1, index1), getExtraPoint(node2, index2)])
        let combine = (distribution) => sourcePosition[0].map((v, i) => distribution.map((v, j) => v * sourcePosition[j][i]).reduce((a, b) => a + b))
        if (pl.type == 'parallelNegative') {
            lineData = ((a) => [
                ['M',
                    [1, 0, 0, 0, 0, 0]
                ],
                ['C',
                    [1, 0, 0, a[0], -a[0], 0],
                    [a[0], 1, 0, 0, 0, -a[0]],
                    [0, 1, 0, 0, 0, 0]
                ]
            ])([argExtra])
        } else if (pl.type == 'parallelPositive') {
            lineData = ((a) => [
                ['M',
                    [1, 0, 0, 0, 0, 0]
                ],
                ['C',
                    [1, 0, a[0], 0, -a[0], 0],
                    [a[0], 0, 1, 0, 0, -a[0]],
                    [0, 0, 1, 0, 0, 0],
                ]

            ])([argExtra])
        } else if (pl.type == 'direct') {
            lineData = ((a) => [
                ['M',
                    [1, 0, 0, 0]
                ],
                ['C',
                    [1, a[0], -a[0], 0],
                    [a[0], 1, 0, -a[0]],
                    [0, 1, 0, 0],
                ]

            ])([argExtra])
        }
        SVGLineData = lineData.map(v => [v[0], v.slice(1).map(v => pl.calculateSVGPosition(combine(v)))])
        if (flagDebug) {
            globalThis.extraDebug = { node1, node2, index1, index2, pl, getExtraPoint, sourcePosition, combine, lineData, SVGLineData }
            // var {node1,node2,index1,index2,pl,getExtraPoint,sourcePosition,combine,lineData,SVGLineData} = globalThis.extraDebug
        }
        return SVGLineData;
    }
    PictureLine.prototype.renderLine = function () {
        let SVGLineData = getSVGLineData(this);
        let SVGLineString = JSON.stringify(SVGLineData).replace(/[^-.MLQC0-9]+/g, ' ').trim()
        let SVGString = `<path d="${SVGLineString}" class="backline ${this.getCommonClass()}"/>\n<path d="${SVGLineString}" class="frontline ${this.getCommonClass()}"/>\n`
        return [[this.renderOrder(), SVGString]]
    }
    PictureLine.prototype.renderCharge = function () {

        let SVGLineData = getSVGLineData(this);
        let curve = new Bezier(
            ...SVGLineData[0][1][0],
            ...SVGLineData[1][1][0],
            ...SVGLineData[1][1][1],
            ...SVGLineData[1][1][2],
        )
        let { x, y } = curve.offset(0.5, 0)
        let SVGChargeData = [x, y]

        // fill r here only for the compatible of SVGToPDF
        // in web browser, css-r has higher order than attribute-r
        let SVGString = `<circle cx="${SVGChargeData[0]}" cy="${SVGChargeData[1]}" r="${this.qvt.frontlineWidth / 2 + this.qvt.chargeRadiusPlus}" class="charge ${this.getCommonClass()}"/>\n`
        return [[this.renderOrder(), SVGString]]
    }
    QVT.prototype.getSVGViewBox = function () {
        return `0 0 3000 6000`
        return `0 0 10000 6000`
        return `0 0 1600 1600`
        return `0 0 800 800`
    }
    QVT.prototype.getSVGWidth = function () {
        return 3000
    }
    QVT.prototype.getSVGHeight = function () {
        return 1000
    }
    QVT.prototype.generateSVGFrame = function (SVGContentString) {
        // viewBox="${this.getSVGViewBox()}"
        let svgid = ('a' + Math.random()).replace('.', '')
        qvt.svgid = svgid
        let SVGFrame = `
        <svg id="${svgid}" xmlns="http://www.w3.org/2000/svg" width="${this.getSVGWidth()}" height="${this.getSVGHeight()}" viewBox="${this.getSVGViewBox()}">
            <defs xmlns="http://www.w3.org/2000/svg">
                <style xmlns="http://www.w3.org/2000/svg" type="text/css"><![CDATA[
                    ${this.getSVGCSS().replace(/([\w.]+{)/g, `#${svgid} $1`)}
                ]]></style>
            </defs>
            ${SVGContentString}
        </svg>
        `
        return SVGFrame
    }
    let qvt = new QVT().init();
    if (flagDebug) {
        globalThis.qvt = qvt;
    }
    qvt.setInput(stringsrc)
    qvt.getNodes()
    qvt.getLines()
    return qvt.getSVGContentString()
    // qvt.getSVGFrame()
    // return qvt.SVGFrame
}

function generateRandomCircuit(n, depth) {
    let list = [
        'cz',
        'cz',
        'cz',
        'cz',
        'cz',
        'cz',
        'cz',
        'cz',
        'cz',
        'cz',
        'cz',
        'cz',

        'h',
        'h1',
        'h2',
        'h3',
        's',
        's1',
        'sd',
        'sd1',
        'h',
        'h1',
        'h2',
        'h3',
        's',
        's1',
        'sd',
        'sd1',

        'x',
        'x1',
        'y',
        'y1',
        'z',
        'z1',
    ]
    let gates = [...Array(depth)].map(v => [...Array(n)].map(v => ''))
    let ncz = 0
    let nextskip = false
    gates.forEach((d, di) => {
        d.forEach((q, qi) => {
            if (nextskip) {
                nextskip = false
                return
            }
            let gi = list[~~(Math.random() * list.length)]
            while (gi == 'cz' && (qi == n - 1 || (di > 0 && gates[di - 1][qi].slice(0, 2) == 'cz' && QVTGConfig.disable_connecting_cz))) {
                gi = list[~~(Math.random() * list.length)]
            }
            gates[di][qi] = gi
            if (gi == 'cz') {
                ncz++
                gates[di][qi] = gi + ncz
                ncz++
                gates[di][qi + 1] = gi + ncz
                nextskip = true
            }
        })
    })
    return gates
}

function main(params) {

    let vars = {}

    let prepareTextOnInput = function (ele) {
        ele.parentElement.querySelector('span.textpreview').innerText=ele.value
        const lines = ele.value.split('\n')
        let maxLength = Math.max.apply(null,lines.map(v=>v.length))
        var { imgCanvas } = Potrace.getVars();

        const canvas = imgCanvas;
        canvas.width = maxLength * 36 ;
        canvas.height = lines.length * 74 ;
        canvas.style.letterSpacing = "3.6px";
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle="white";
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.textBaseline = "middle";
        ctx.font="53px 'Architects Daughter'";
        ctx.shadowColor="black";
        ctx.shadowBlur=3;
        ctx.fillStyle="black";
        // to apply text-shadow twice
        ([0,1]).forEach(v=>{
            lines.forEach((v,i)=>{
                ctx.fillText(v,5,5+37+i*74);
            })
        })
        Potrace.loadImageFromUrl(canvas.toDataURL());
    }
    
    let useLocalFile = function () {
        util.upload(function (files) {
            Potrace.loadImageFromFile(files[0])
        })
    }

    let pictureToBoundary = function (cb) {
        Potrace.process(function () {
            let length_filter = 10;
            let svg = getSVGWithFilter(1, "curve", length_filter);
            // document.querySelector('div.boundary').innerHTML = svg;
            let svg64 = 'data:image/svg+xml;base64,'+btoa(svg)
            let img = document.createElement('img')
            img.src = svg64
            document.querySelector('div.boundary').innerHTML=''
            document.querySelector('div.boundary').appendChild(img)
            cb()
        })
    }

    let boundaryToQuon = function () {
        let length_filter = 10;
        let lines = getBezierList(length_filter);
        if (flagDebug) {
            globalThis.lines = lines;
            console.log(lines);
        }
        function drawPictureQvt() {
            let svg = testDrawQVT(lines[0]);
            lines.forEach((v, i) => {
                if (i == 0) {
                    return
                }
                svg += testDrawQVT(lines[i]);
            })
            let qvt = new QVT().init()
            var { bm } = Potrace.getVars();
            qvt.getSVGWidth = () => bm.w * QVTGConfig.svg_size_ratio
            qvt.getSVGHeight = () => bm.h * QVTGConfig.svg_size_ratio
            qvt.getSVGViewBox = () => `0 0 ${bm.w * QVTGConfig.svg_position_ratio} ${bm.h * QVTGConfig.svg_position_ratio}`
            svg = qvt.generateSVGFrame(svg);
            let svgid = qvt.svgid
            let w = bm.w
            let h = bm.h
            let svgw = bm.w * QVTGConfig.svg_size_ratio
            let svgh = bm.h * QVTGConfig.svg_size_ratio
            return {svg,svgid,svgw,svgh,w,h}
        }
        let {svg,svgid,svgw,svgh,w,h} = drawPictureQvt()
        let svg64 = 'data:image/svg+xml;base64,'+btoa(svg)
        // let ele = document.querySelector('div.quonimg')
        // ele.style.backgroundSize = ele.style.width=w*3+'px'
        // ele.style.height=h*3+'px'
        // ele.style.backgroundImage = 'url("'+svg64+'")';
        let img = document.createElement('img')
        let imgw=w*3
        let imgh=h*3
        img.width = imgw
        img.height = imgh
        img.src = svg64
        document.querySelector('div.quonimg').innerHTML=''
        document.querySelector('div.quonimg').appendChild(img)
        vars.quon = {svg,svgid,svgw,svgh,imgw,imgh,w,h,svg64}
        return {svg,svgid,svgw,svgh,imgw,imgh,w,h,svg64}
    }

    let useLocalTexture = function () {
        util.upload(function (files) {
            var reader = new FileReader();
            reader.onload = function(e) {
                document.querySelector("#texture").src = e.target.result;
            };
            reader.readAsDataURL(files[0]);
        })
    }

    let addTexture_as_mark = function () {
        document.querySelector('.coloredquon').innerHTML=''
        let {svg,svgid,svgw,svgh,imgw,imgh,w,h,svg64} = vars.quon
        var textureElement = document.querySelector("#texture")
        var imgElement = document.createElement('img')
        var imgCanvas = document.createElement("canvas")
        var imgCanvas2 = document.createElement("canvas")
        imgElement.src = svg64
        imgElement.onload=()=>{
            imgCanvas.width = textureElement.width;
            imgCanvas.height = textureElement.height;
            var ctx = imgCanvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0,0,textureElement.width,textureElement.height);
            ctx.drawImage(imgElement, 0, 0, textureElement.width,textureElement.height);
            var imgdataobj = ctx.getImageData(0, 0, textureElement.width, textureElement.height);

            imgCanvas2.width = textureElement.width;
            imgCanvas2.height = textureElement.height;
            var ctx2 = imgCanvas2.getContext('2d');
            ctx2.clearRect(0,0,textureElement.width,textureElement.height);
            ctx2.drawImage(textureElement, 0, 0, textureElement.width,textureElement.height);
            var imgdataobj2 = ctx2.getImageData(0, 0, textureElement.width, textureElement.height);

            var l = imgdataobj.data.length, i, j, color;
            for (i = 0, j = 0; i < l; i += 4, j++) {
                imgdataobj2.data[i + 3] = imgdataobj.data[i]
            }
            ctx.clearRect(0,0,imgElement.width,imgElement.height)
            ctx.putImageData(imgdataobj, 0, 0);

            ctx2.clearRect(0,0,imgElement.width,imgElement.height)
            // ctx2.fillStyle = 'white';
            // ctx2.fillRect(0,0,imgElement.width,imgElement.height);
            ctx2.putImageData(imgdataobj2, 0, 0);

            // document.querySelector('.coloredquon').appendChild(imgCanvas)
            // document.querySelector('.coloredquon').appendChild(imgCanvas2)

            let img = document.createElement('img')
            img.src = imgCanvas2.toDataURL()
            img.width = textureElement.width
            img.height = textureElement.height
            document.querySelector('.coloredquon').appendChild(img)
        }
        // document.querySelector('.coloredquon').appendChild(imgElement)
    }
    let addTexture = function () {
        document.querySelector('.coloredquon').innerHTML=''
        let {svg,svgid,svgw,svgh,imgw,imgh,w,h,svg64} = vars.quon
        var imgElement = document.createElement('img')
        var imgCanvas = document.createElement("canvas")
        var imgCanvas2 = document.createElement("canvas")
        imgElement.src = svg64
        imgElement.onload=()=>{
            imgCanvas.width = imgElement.width;
            imgCanvas.height = imgElement.height;
            var ctx = imgCanvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0,0,imgElement.width,imgElement.height);
            ctx.drawImage(imgElement, 0, 0);
            var imgdataobj = ctx.getImageData(0, 0, imgElement.width, imgElement.height);

            imgCanvas2.width = imgElement.width;
            imgCanvas2.height = imgElement.height;
            var ctx2 = imgCanvas2.getContext('2d');
            ctx2.clearRect(0,0,imgElement.width,imgElement.height);
            ctx2.drawImage(document.querySelector("#texture"), 0, 0,imgElement.width,imgElement.height);
            var imgdataobj2 = ctx2.getImageData(0, 0, imgElement.width, imgElement.height);
            console.log(imgdataobj2);

            var l = imgdataobj.data.length, i, j, color;
            for (i = 0, j = 0; i < l; i += 4, j++) {
                var sum = imgdataobj.data[i]+imgdataobj.data[i + 1]+imgdataobj.data[i + 2]
                if (sum==255*3) {
                    imgdataobj.data[i]=imgdataobj.data[i + 1]=imgdataobj.data[i + 2]=imgdataobj.data[i + 3]=0
                }
                if (sum!=0 && sum!=255*3) {
                    globalThis.debugobj = [sum,imgdataobj.data[i],imgdataobj.data[i + 1],imgdataobj.data[i + 2],imgdataobj.data[i + 3]]
                    imgdataobj.data[i + 3] = 255-sum,imgdataobj.data[i]
                    imgdataobj.data[i]=imgdataobj.data[i + 1]=imgdataobj.data[i + 2]=0
                }
                imgdataobj2.data[i + 3]=imgdataobj.data[i + 3]
            }
            ctx.clearRect(0,0,imgElement.width,imgElement.height)
            ctx.putImageData(imgdataobj, 0, 0);

            ctx2.clearRect(0,0,imgElement.width,imgElement.height)
            ctx2.putImageData(imgdataobj2, 0, 0);

            // document.querySelector('.coloredquon').appendChild(imgCanvas)
            // document.querySelector('.coloredquon').appendChild(imgCanvas2)

            let img = document.createElement('img')
            img.src = imgCanvas2.toDataURL()
            img.width = imgw
            img.height = imgh
            document.querySelector('.coloredquon').appendChild(img)
        }
        // document.querySelector('.coloredquon').appendChild(imgElement)
    }

    window.onload = ()=>{
        //  put canvas in Dom
        var { imgCanvas } = Potrace.getVars();
        document.querySelector('.canvasarea').appendChild(imgCanvas);
        
        // listen
        document.querySelector('textarea.preparetext').oninput = function(){prepareTextOnInput(this)}
        document.querySelector("#step1 > input.loadfile").onclick = function(){useLocalFile()}
        document.querySelector("#step1 > input.exec").onclick = function(){pictureToBoundary(()=>boundaryToQuon());}
        document.querySelector("#step3 > input.loadfile").onclick = function(){useLocalTexture()}
        document.querySelector("#step3 > input.exec").onclick = function(){addTexture()}
        document.querySelector("#step3 > input.exec_as_mark").onclick = function(){addTexture_as_mark()}

        // exec once
        prepareTextOnInput(document.querySelector('textarea.preparetext'))
        pictureToBoundary(()=>{boundaryToQuon();addTexture()});
    }
}

export { main };