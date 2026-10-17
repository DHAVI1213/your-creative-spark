import {describe,it,expect} from 'bun:test';
import {DEFAULTS,canvasSize,layout,timing,FILTROS,limpezaFilters,filtroSpec} from '../src/lib/editor/shared.js';
import {buildArgs} from '../src/lib/editor/builder.js';
import {targetIds,captionsFromLines,outputName,memoryWarning,type EditorJob} from '../src/lib/editor/model';
const meta={width:1920,height:1080,duration:10,hasAudio:true};
const settings=()=>structuredClone(DEFAULTS);
describe('Editor em Massa',()=>{
 it('targets only Este, Seleção or Todos',()=>{const jobs=[{id:'a'},{id:'b'},{id:'c'}] as EditorJob[];expect(targetIds(jobs,'a',['b'],'este')).toEqual(['a']);expect(targetIds(jobs,'a',['b'],'selecao')).toEqual(['b']);expect(targetIds(jobs,'a',['b'],'todos')).toEqual(['a','b','c']);});
 it('breaks batch captions at | and names outputs _editado.mp4',()=>{expect(captionsFromLines('A|B\nC')).toEqual(['A\nB','C']);expect(captionsFromLines('A\n\nC')).toEqual(['A','','C']);expect(outputName('meu.video.mov')).toBe('meu.video_editado.mp4');});
 it('offers ten filters and intensity zero disables transformation',()=>{expect(Object.keys(FILTROS).filter(k=>k!=='nenhum')).toHaveLength(10);const s=settings();s.efeitos.filtro='sepia';s.efeitos.filtroForca=0;expect(filtroSpec(s.efeitos)).toBeNull();s.efeitos.filtroForca=1;expect(filtroSpec(s.efeitos)?.m[0]).toBe(0.393);});
 it('limits 4K to 3840 by 2160 and never uses 8K or GPU',()=>{const s=settings();s.saida.res=2160;expect(canvasSize(s,meta)).toEqual({CW:3840,CH:2160});s.saida.res=4320;expect(canvasSize(s,meta)).toEqual({CW:1080,CH:1920});const b=buildArgs({meta,s,input:'in'},{bg:'bg',ov:'ov',out:'out',capa:null});expect(b.args).toContain('libx264');expect(b.args.join(' ')).not.toContain('nvenc');});
 it('trims exactly 0.5 seconds from each end',()=>{const s=settings();s.efeitos.cortarPontas=true;expect(timing(meta,s)).toMatchObject({start:.5,end:9.5,outDur:9});});
 it('applies crop cleanup and reconstruction regions',()=>{const s=settings();s.limpeza.modo='ambos';expect(layout(meta,s)).toMatchObject({top:216,ch:594});s.limpeza.metodo='reconstruir';expect(limpezaFilters(meta,s).join(',')).toContain('delogo=');});
 it('includes conventional enhancement and removes metadata',()=>{const s=settings();s.saida.melhorarVideo=true;const b=buildArgs({meta,s,input:'in'},{bg:'bg',ov:'ov',out:'out',capa:null});expect(b.args.join(' ')).toContain('hqdn3d=');expect(b.args.join(' ')).toContain('flags=lanczos');expect(b.args.join(' ')).toContain('unsharp=');expect(b.args.slice(b.args.indexOf('-map_metadata'),b.args.indexOf('-map_metadata')+2)).toEqual(['-map_metadata','-1']);});
 it('warns and blocks browser-memory unsafe files',()=>{expect(memoryWarning(250*1024**2,720,1280).large).toBe(true);expect(memoryWarning(1024**3,720,1280).blocked).toBe(true);expect(memoryWarning(1024,720,1280).blocked).toBe(false);});
});
