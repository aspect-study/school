// Anything: every property, call and `new` gives itself back, so drawing code runs without a real Three.js or canvas.
const any = new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : any),
  apply: () => any,
  construct: () => any,
  set: () => true,
});
const loose = (o) => new Proxy(o, { get: (t, k) => (k in t ? t[k] : any) });
const vec = (v) => loose({ x: v, y: v, z: v, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; }, copy(p) { return this.set(p.x, p.y, p.z); } });
class Obj {
  constructor() { this.children = []; this.parent = null; this.userData = {}; this.position = vec(0); this.rotation = vec(0); this.scale = vec(1); }
  add(c) { this.children.push(c); c.parent = this; return this; }
  remove(c) { this.children = this.children.filter((x) => x !== c); c.parent = null; return this; }
  traverse(fn) { fn(this); this.children.forEach((c) => c.traverse(fn)); }
}
const obj = () => loose(new Obj());
let uuid = 0;
const material = () => loose({ uuid: 'm' + ++uuid, clone: material, dispose() {} });
const mesh = (m) => { const o = obj(); o.material = typeof m === 'string' ? material() : m; o.isMesh = true; return o; };
function fakeS() {
  const scene = obj();
  const THREE = new Proxy({}, { get: (t, k) => (k === 'Group' ? function () { return obj(); } : k === 'Mesh' ? function (g, m) { return mesh(m); } : any) });
  return new Proxy({ scene, THREE }, {
    get: (t, k) => {
      if (k in t) return t[k];
      if (k === 'add') return (g, m, x, y, z, parent) => { const o = mesh(m); o.position.set(x || 0, y || 0, z || 0); (parent || scene).add(o); return o; };
      if (k === 'sprite') return () => { const o = obj(); o.material = any; return o; };
      if (k === 'toon') return material;
      return () => any;
    },
  });
}
global.document = { createElement: () => ({ getContext: () => any }) };

module.exports = { any, loose, vec, Obj, obj, material, mesh, fakeS };
