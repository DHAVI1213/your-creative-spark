/**
 * Leitura do site clonado: quais animações e efeitos ele usa, e um "adaptador"
 * que deixa os scripts do site rodarem dentro da prévia protegida.
 */

export type Recurso = {
  nome: string;
  tipo: "rolagem" | "animacao" | "3d" | "midia" | "plataforma";
};

const ASSINATURAS: { nome: string; tipo: Recurso["tipo"]; re: RegExp }[] = [
  {
    nome: "GSAP",
    tipo: "animacao",
    re: /gsap(\.min)?\.js|\bgsap\.(to|from|timeline)\b|cdn\.jsdelivr\.net\/npm\/gsap/i,
  },
  { nome: "ScrollTrigger", tipo: "rolagem", re: /ScrollTrigger/ },
  { nome: "Lenis (rolagem suave)", tipo: "rolagem", re: /lenis/i },
  { nome: "Locomotive Scroll", tipo: "rolagem", re: /locomotive-scroll|data-scroll-container/i },
  { nome: "AOS (animar ao rolar)", tipo: "rolagem", re: /aos(\.min)?\.(js|css)|data-aos=/i },
  { nome: "ScrollReveal", tipo: "rolagem", re: /scrollreveal/i },
  { nome: "WOW.js", tipo: "rolagem", re: /wow(\.min)?\.js|class="[^"]*\bwow\b/i },
  { nome: "Rellax (parallax)", tipo: "rolagem", re: /rellax/i },
  { nome: "Framer Motion", tipo: "animacao", re: /framer-motion|data-framer-/i },
  { nome: "Anime.js", tipo: "animacao", re: /anime(\.min)?\.js|animejs/i },
  { nome: "Lottie", tipo: "animacao", re: /lottie|bodymovin|dotlottie/i },
  { nome: "Rive", tipo: "animacao", re: /rive\.app|@rive-app|\.riv["']/i },
  { nome: "Swiper (carrossel)", tipo: "animacao", re: /swiper/i },
  { nome: "Splide (carrossel)", tipo: "animacao", re: /splide/i },
  { nome: "Barba.js (transições)", tipo: "animacao", re: /barba(\.min)?\.js|data-barba/i },
  {
    nome: "Three.js",
    tipo: "3d",
    re: /three(\.module)?(\.min)?\.js|\bTHREE\.|@react-three|\/three@/i,
  },
  { nome: "Spline", tipo: "3d", re: /spline(tool)?\.(design|com)|@splinetool/i },
  { nome: "Babylon.js", tipo: "3d", re: /babylon(js)?/i },
  { nome: "Modelo 3D (.glb/.gltf)", tipo: "3d", re: /\.(glb|gltf)["'?]/i },
  { nome: "Canvas / WebGL", tipo: "3d", re: /<canvas\b|webgl/i },
  { nome: "Partículas", tipo: "animacao", re: /particles(\.min)?\.js|tsparticles/i },
  { nome: "Vídeo de fundo", tipo: "midia", re: /<video\b[^>]*\b(autoplay|muted)\b/i },
  { nome: "Webflow (interações)", tipo: "plataforma", re: /webflow\.js|data-w-id=/i },
  { nome: "Framer (site)", tipo: "plataforma", re: /framerusercontent|framer\.com\/m\//i },
  { nome: "Elementor", tipo: "plataforma", re: /elementor/i },
  { nome: "Wix", tipo: "plataforma", re: /wixstatic|wix\.com/i },
  { nome: "Next.js", tipo: "plataforma", re: /\/_next\/static\//i },
];

/** Lista os recursos de animação/3D encontrados no HTML (e nos nomes dos scripts). */
export function detectarRecursos(html: string): Recurso[] {
  const achados: Recurso[] = [];
  for (const a of ASSINATURAS) if (a.re.test(html)) achados.push({ nome: a.nome, tipo: a.tipo });
  return achados;
}

/**
 * Script injetado no começo da prévia: dá armazenamento em memória e evita erros de
 * histórico/cookies, que dentro da prévia protegida derrubariam os scripts do site
 * (e com eles as animações). A prévia continua sem acesso ao app.
 */
const ADAPTADOR = `<script data-fabrica-adaptador>(function(){
function mem(){var s={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(s,k)?s[k]:null},setItem:function(k,v){s[k]=String(v)},removeItem:function(k){delete s[k]},clear:function(){s={}},key:function(i){return Object.keys(s)[i]||null},get length(){return Object.keys(s).length}}}
['localStorage','sessionStorage'].forEach(function(n){try{window[n].getItem('x')}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(_){}}});
['pushState','replaceState'].forEach(function(k){var o=history[k];history[k]=function(){try{return o.apply(history,arguments)}catch(e){}}});
try{document.cookie}catch(e){try{Object.defineProperty(document,'cookie',{get:function(){return''},set:function(){},configurable:true})}catch(_){}}
function lazy(){document.querySelectorAll('img[data-src],img[data-lazy-src],source[data-srcset],img[data-srcset]').forEach(function(el){var s=el.getAttribute('data-src')||el.getAttribute('data-lazy-src');if(s&&!el.getAttribute('src'))el.setAttribute('src',s);var ss=el.getAttribute('data-srcset');if(ss&&!el.getAttribute('srcset'))el.setAttribute('srcset',ss);});}
document.addEventListener('DOMContentLoaded',lazy);setTimeout(lazy,1500);
})();</script>`;

/** HTML pronto para a prévia: adaptador no topo do <head>. */
export function prepararPrevia(html: string): string {
  if (html.includes("data-fabrica-adaptador")) return html;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${ADAPTADOR}`);
  return ADAPTADOR + html;
}

/** Tira o adaptador antes de exportar (o site final não precisa dele). */
export function limparAdaptador(html: string): string {
  return html.replace(/<script data-fabrica-adaptador>[\s\S]*?<\/script>/g, "");
}
