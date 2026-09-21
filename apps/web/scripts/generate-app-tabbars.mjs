/**
 * Gera as tab bars das réplicas da landing do aplicativo a partir das capturas.
 *
 *   node scripts/generate-app-tabbars.mjs   (a partir de apps/web)
 *
 * A tab bar do iOS é a nativa do sistema (Liquid Glass com SF Symbols), e um
 * redesenho em SVG sempre lia como outro aplicativo ao lado das capturas
 * verdadeiras. Estas imagens SÃO os pixels das capturas de public/mockup-ios.
 *
 * Só a agenda.jpg tem a barra sobre fundo vazio. Nas outras o vidro deixa ver o
 * conteúdo de trás, então cada barra é montada:
 *
 * - agente:     a agenda.jpg, como está.
 * - financeiro: a agenda.jpg, com a célula do Agente INATIVA e a pílula do
 *               Financeiro trazidas da financeiro2.jpg (mesmo aparelho, mesma
 *               geometria, nada atrás nessas duas regiões).
 * - hoje:       a mesma base, com a pílula limpa da agenda.jpg levada para a
 *               primeira aba, o sol e o rótulo brancos da agenda.jpg pintados de
 *               verde (o sol ganha o miolo, porque o ativo é "sun.max.fill") e o
 *               selo "9+" da hoje.jpg.
 *
 * Onde as duas fontes têm pílula ao mesmo tempo (x entre a borda da pílula do
 * Financeiro e a do Agente), só cabe fundo de barra, e ele vem de uma coluna
 * limpa. Ao trocar as capturas, rode de novo e CONFIRA AS TRÊS IMAGENS a olho:
 * os limiares daqui foram calibrados nestas capturas.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const T = 'public/mockup-ios';
async function load(p, scale) {
  let s = sharp(p);
  if (scale) { const m = await sharp(p).metadata(); s = s.resize(Math.round(m.width*scale)); }
  const {data, info} = await s.removeAlpha().raw().toBuffer({resolveWithObject:true});
  return {d: Buffer.from(data), W: info.width, H: info.height};
}
const px = (im,x,y)=>{const i=(y*im.W+x)*3;return [im.d[i],im.d[i+1],im.d[i+2]]};
const put = (im,x,y,c)=>{const i=(y*im.W+x)*3;im.d[i]=c[0];im.d[i+1]=c[1];im.d[i+2]=c[2]};
const lum = c=>(c[0]+c[1]+c[2])/3;
const rosa = c=> c[0]>140 && c[0]-c[1]>35;

function capsula(im, y0) {
  // y0: row at the vertical middle of the bar
  let l=0; while (lum(px(im,l,y0))<26 || lum(px(im,l+3,y0))<26) l++;
  let r=im.W-1; while (lum(px(im,r,y0))<26 || lum(px(im,r-3,y0))<26) r--;
  const xm = Math.round(l + (r-l)*0.4);
  let t=y0; while (lum(px(im,xm,t-1))>=26) t--;
  let b=y0; while (lum(px(im,xm,b+1))>=26) b++;
  return {l,r,t,b};
}
function bbox(im, rect, pred) {
  let x0=1e9,y0=1e9,x1=-1,y1=-1;
  for (let y=rect.t;y<=rect.b;y++) for (let x=rect.l;x<=rect.r;x++) if (pred(px(im,x,y),x,y)) {x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  return {l:x0,r:x1,t:y0,b:y1};
}
async function save(im, cap, nome) {
  const w = cap.r-cap.l+1, h = cap.b-cap.t+1;
  const rgba = Buffer.alloc(w*h*4);
  const rad = h/2;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const c = px(im, cap.l+x, cap.t+y);
    // capsule alpha with 1px antialias
    const cx = x < rad ? rad : (x > w-1-rad ? w-1-rad : x);
    const dist = Math.hypot(x-cx, y-(h-1)/2);
    const a = Math.max(0, Math.min(1, rad - dist + 0.5));
    const o=(y*w+x)*4; rgba[o]=c[0];rgba[o+1]=c[1];rgba[o+2]=c[2];rgba[o+3]=Math.round(a*255);
  }
  await sharp(rgba,{raw:{width:w,height:h,channels:4}}).png({compressionLevel:9}).toFile(`${T}/tabbar-${nome}.png`);
  console.log(nome, w, h);
}
(async () => {
  const ag = await load('public/mockup-ios/agenda.jpg');
  const fi = await load('public/mockup-ios/financeiro2.jpg');
  const ho = await load('public/mockup-ios/hoje.jpg', 589/736);
  const Y = Math.round(ag.H*0.885)+70;
  const capA = capsula(ag, Y), capF = capsula(fi, Y);
  console.log('capA', capA, 'capF', capF);

  // 1. agente ativo: a captura limpa
  await save(ag, capA, 'agente');
  const cw = (capA.r-capA.l)/5;
  const pilA = bbox(ag, {l:Math.round(capA.l+cw*3), r:Math.round(capA.l+cw*4), t:capA.t+2, b:capA.b-2}, c => lum(c) > 45);
  console.log('pilA', pilA);
  const PT = pilA.t, PB = pilA.b; // altura da pilula, igual nas tres
  const Ymeio = Math.round((PT+PB)/2);

  // Copia colunas x0..x1 da capsula de src para im, na MESMA posicao (as capturas
  // de 589px sao do mesmo aparelho), com as bordas misturadas em F pixels.
  function copia(src, im, x0, x1, F, filtro) {
    for (let y=capA.t;y<=capA.b;y++) for (let x=x0-F;x<=x1+F;x++) {
      let w = 1;
      if (x < x0) w = (x-(x0-F))/F; else if (x > x1) w = ((x1+F)-x)/F;
      let s = px(src,x,y);
      if (filtro) s = filtro(s,x,y);
      if (!s) continue;
      const d = px(im,x,y);
      put(im,x,y, d.map((v,k)=>Math.round(v*(1-w)+s[k]*w)));
    }
  }
  function limitesPilula(im, xa, xb) {
    let l=xa; while (lum(px(im,l,Ymeio))<45) l++;
    let r=xb; while (lum(px(im,r,Ymeio))<45) r--;
    return {l, r};
  }

  // Coluna limpa da agenda (sem icone nem pilula), para fundo de barra por linha.
  const GAP = Math.round(capA.l+cw*2) - 8;
  for (let y=PT+3;y<=PB-3;y+=3) if (lum(px(ag,GAP,y))>45) throw new Error('GAP sujo em '+y);
  function baseInativa() {
    const im = {d: Buffer.from(ag.d), W: ag.W, H: ag.H};
    // Onde as duas fontes tem pilula (o fim da do Financeiro na financeiro2 e o
    // comeco da do Agente na agenda), so cabe fundo de barra.
    const fimPilF = limitesPilula(fi, Math.round(capA.l+cw*2)-10, Math.round(capA.l+cw*3)+10).r;
    for (let y=capA.t;y<=capA.b;y++) for (let x=pilA.l-4;x<=fimPilF+5;x++) put(im,x,y,px(ag,GAP,y));
    copia(fi, im, fimPilF+6, pilA.r+2, 0);
    return im;
  }

  // 2. financeiro ativo
  {
    const im = baseInativa();
    const pf = limitesPilula(fi, Math.round(capA.l+cw*2)-10, Math.round(capA.l+cw*3)+10);
    console.log('pilF', pf);
    copia(fi, im, pf.l-2, pf.r+2, 6);
    await save(im, capA, 'financeiro');
  }

  // 3. hoje ativo
  {
    const im = baseInativa();
    const ph = limitesPilula(ho, capA.l+2, Math.round(capA.l+cw)+10);
    const seloH = bbox(ho, {l:capA.l, r:Math.round(capA.l+cw*1.3), t:PT-6, b:PB}, rosa);
    console.log('pilH', ph, 'seloH', seloH);
    // Fundo da pilula: o da agenda, que nao tem nada atras do vidro. O icone
    // verde dela sai pela mediana da linha.
    const medAg = {};
    for (let y=PT;y<=PB;y++) {
      const v=[]; for (let x=pilA.l+8;x<=pilA.r-8;x++){const c=px(ag,x,y); if(c[1]-Math.max(c[0],c[2])<3 && lum(c)>45 && lum(c)<100) v.push(c);}
      v.sort((a,b)=>lum(a)-lum(b)); medAg[y]= v.length? v[Math.floor(v.length/2)] : null;
    }
    for (let y=PT;y<=PB;y++) if (!medAg[y]) medAg[y] = medAg[y-1] || medAg[y+1];
    const iconeAg = bbox(ag, {l:pilA.l, r:pilA.r, t:PT, b:PB}, c => c[1]-Math.max(c[0],c[2]) >= 12);
    const fundoPilula = (x,y) => {
      const xx = pilA.l + Math.round((x-ph.l)*(pilA.r-pilA.l)/(ph.r-ph.l));
      const naAreaDoIcone = xx>=iconeAg.l-4 && xx<=iconeAg.r+4 && y>=iconeAg.t-4 && y<=iconeAg.b+4;
      return naAreaDoIcone ? medAg[y] : px(ag,xx,y);
    };
    // A cor de destaque como a captura a pinta.
    // tirada da pilula do Financeiro da financeiro2, que nao tem nada atras
    const verdes = [];
    for (let y=PT;y<=PB;y++) for (let x=Math.round(capA.l+cw*2);x<=Math.round(capA.l+cw*3);x++){const c=px(fi,x,y); if(c[1]-Math.max(c[0],c[2])>40) verdes.push(c);}
    verdes.sort((a,b)=>lum(a)-lum(b));
    const tinta = verdes[Math.floor(verdes.length*0.5)];
    const lumBarra = lum(px(ag, GAP, Ymeio));
    // o sol inativo da agenda: o anel e o que e claro na linha do centro
    const c0 = {l: capA.l+4, r: Math.round(capA.l+cw), t: PT, b: PB};
    const claroSol = bbox(ag, {l:c0.l, r:c0.r, t:PT, b:Math.round((PT+PB)/2)+6}, (c,x,y) => lum(c) > 120 && !rosa(c) && !(x>=seloH.l-2 && y<=seloH.b+2));
    // centro pelos raios: o de cima da o x, o da esquerda da o y
    const media = arr => arr.reduce((s,v)=>s+v,0)/arr.length;
    const xsTopo = []; for (let x=c0.l;x<seloH.l-3;x++) if (lum(px(ag,x,claroSol.t+1))>120) xsTopo.push(x);
    const ysEsq = []; for (let y=PT;y<=PB;y++) if (lum(px(ag,claroSol.l+1,y))>120) ysEsq.push(y);
    const sol = { x: media(xsTopo), y: media(ysEsq) };
    let rr = 0; while (lum(px(ag, Math.round(sol.x)+rr, Math.round(sol.y))) < 120 && rr < 20) rr++;
    sol.r = rr + 0.6;
    console.log('tinta', tinta, 'sol', sol);
    const naCaixaDoSelo = (x,y) => x>=seloH.l-2 && x<=seloH.r+2 && y>=seloH.t-2 && y<=seloH.b+2;
    for (let y=capA.t;y<=capA.b;y++) for (let x=ph.l-4;x<=Math.max(ph.r,seloH.r)+4;x++) {
      const dentro = x>=ph.l && x<=ph.r && y>=PT && y<=PB;
      // 1. fundo: pilula limpa dentro, fundo de barra fora
      let c = dentro ? fundoPilula(x,y) : px(ag,GAP,y);
      // 2. sol e rotulo: os brancos da agenda (limpos), pintados de verde, e o
      //    miolo do sol preenchido, porque o ativo e a versao cheia do simbolo
      const s = px(ho,x,y);
      if (dentro && !naCaixaDoSelo(x,y)) {
        const w = px(ag,x,y);
        let a = Math.max(0, Math.min(1, (lum(w) - lumBarra) / (230 - lumBarra)));
        if (Math.hypot(x-sol.x, y-sol.y) <= sol.r) a = 1;
        if (a > 0) c = c.map((v,k)=>Math.round(v*(1-a)+tinta[k]*a));
      }
      // 3. o selo: rosa, o texto branco e a transicao para o fundo
      if (naCaixaDoSelo(x,y)) {
        const rosado = s[0]-s[1];
        if (rosa(s) || lum(s) > 170) c = s;
        else if (rosado > 12) { const a = Math.min(1,(rosado-12)/40); c = c.map((v,k)=>Math.round(v*(1-a)+s[k]*a)); }
      }
      put(im,x,y,c);
    }
    await save(im, capA, 'hoje');
  }
})();
