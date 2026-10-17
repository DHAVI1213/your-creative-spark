export type Meta = { width:number; height:number; duration:number; hasAudio?:boolean };
export type Region = { x:number; y:number; w:number; h:number };
export type Settings = {
 limpeza:{ modo:string; fonte:string; papel:string; metodo:string; topo:number; base:number; headline:Region; legenda:Region };
 recorte:{ top:number; bottom:number; left:number; right:number; zoom:number; posV:number };
 efeitos:{ espelhar:boolean; cortarPontas:boolean; ajusteAuto:boolean; velocidade:number; antiDup:boolean; melhorarAudio:boolean; corteInicio:number; corteFim:number; filtro:string; filtroForca:number };
 template:{ fundoTipo:string; fundoCor:string; fundoImagem:string|null; logo:string|null; logoPos:string; logoTamanho:number; logoOpacidade:number; molduraEsp:number; molduraCor:string };
 texto:{ pos:string; h:number; v:number; largura:number; fonte:string; peso:number; tamanho:number; espacamento:number; maiusculas:boolean; cor:string; contorno:boolean; contornoCor:string; fundo:boolean; fundoCor:string; ctaAtivo:boolean; ctaTexto:string; ctaV:number; ctaTamanho:number; ctaCor:string; ctaFundo:string };
 capa:{ ativo:boolean; fonte:string; tempo:number; imagem:string|null; texto:string; escurecer:number; v:number; tamanho:number; maiusculas:boolean; cor:string; contorno:boolean; contornoCor:string; destaque:boolean; destaqueCor:string; noInicio:boolean; duracao:number; embutir:boolean; salvarJpg:boolean };
 legendaAnim:{ ativo:boolean; estilo:string; animacao:string; palavras:number; fonte:string; peso:number; tamanho:number; v:number; largura:number; maiusculas:boolean; semPontuacao:boolean; manterInterrogacao:boolean; cor:string; destaque:string; destaque2:string; destaque3:string; trocarCor:boolean; caixaTexto:string; contorno:boolean; contornoCor:string; sombra:boolean; emojis:boolean; emojiTam:number };
 audio:{ modo:string; volume:number; musica:string|null; musicaVolume:number };
 saida:{ res:number; fps:number; bitrate:number; semMetadados:boolean; melhorarVideo:boolean };
};
export type Layout = { CW:number; CH:number; left:number; top:number; cw:number; ch:number; k:number; sw:number; sh:number; dw:number; dh:number; F:number; x:number; y:number };
export type Word = { w:string; s:number; e:number };
export type EmojiMark = { s:number; e:number; ch:string };
/** Dados do corte viral que gerou este vídeo (nota, título e legenda do post escritos pela IA). */
export type CorteInfo = { nota:number; titulo:string; descricao:string; gancho:string; origem:string; emojis?:{palavra:string;emoji:string}[] };
export type EditorJob = { id:string; file:File; url:string; name:string; meta:Meta; thumb:string; caption:string; coverTitle:string; settings:Settings; words?:Word[]; emojis?:EmojiMark[]; corte?:CorteInfo; postTexto?:string; status:'pronto'|'fila'|'processando'|'feito'|'erro'|'cancelado'; progress:number; error?:string; output?:Blob; cover?:Blob };
export type Profile = { id?:string; name:string; settings:Settings; is_default:boolean };
export type Scope = 'este'|'selecao'|'todos';
export function targetIds(jobs:EditorJob[], current:string, selected:string[], scope:Scope) {return jobs.filter(j=>scope==='todos'||(scope==='este'?j.id===current:selected.includes(j.id))).map(j=>j.id);}
export function captionsFromLines(text:string) {return text.split(/\r?\n/).map(s=>s.trim().replace(/\s*\|\s*/g,'\n'));}
export function outputName(name:string) {return name.replace(/\.[^.]+$/,'')+'_editado.mp4';}
export function memoryWarning(fileBytes:number, width:number,height:number) {const estimated=fileBytes*3+width*height*64+256*1024*1024;return {estimated,large:fileBytes>200*1024*1024||estimated>1024**3,blocked:fileBytes>=1024**3||estimated>1800*1024*1024};}
