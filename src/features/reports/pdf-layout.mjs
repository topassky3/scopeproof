// Keep short semantic blocks together, but never force a long historical block onto one page.
// The estimate is intentionally conservative; pdfmake still owns final layout.
const estimatedLines = node => String(node.text ?? '').split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/38)),0);
export function groupPdfContent(content) {
  const output=[];
  let group=[];
  function flush() {
    if (!group.length) return;
    let chunk=[], lines=0;
    function emit() {
      if (chunk.length===1) output.push(chunk[0]);
      else if (chunk.length) output.push({stack:chunk,unbreakable:true});
      chunk=[];lines=0;
    }
    for(const node of group){
      const n=estimatedLines(node)+1;
      if (lines+n>24) emit();
      if(n>24){output.push(node);continue;}
      chunk.push(node);lines+=n;
    }
    emit();group=[];
  }
  for(const node of content){
    if(node.style==='section' || (node.bold && !(group.length===1 && group[0].style==='section'))) flush();
    group.push(node);
  }
  flush();return output;
}
