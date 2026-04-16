import React, { useEffect, useRef, useState } from "react";
import ForceGraph3D from "3d-force-graph";

/* ──────────────────────────────────────────────────────────────
   RIGHTHAND 3D System Visualization — Jarno-grade
   Color-coded orbs, sized by importance, wireframe cluster legend,
   lightning pulse animations on AI activity, auto-rotation.
   ────────────────────────────────────────────────────────────── */

type SysNode = {
  id: string; label: string; kind: string; group: string; size: number;
  x?: number; y?: number; z?: number;
  __pulse?: number; __pulseColor?: string;
};
type SysLink = { source: string; target: string; kind: string };

const GROUPS: Record<string, { color: string; label: string; center: [number,number,number] }> = {
  brain:        { color: "#9f7bff", label: "AI BRAIN",        center: [0, 0, 0] },
  voice:        { color: "#4aa3ff", label: "VOICE ENGINE",    center: [-120, 60, 0] },
  memory:       { color: "#7dd87d", label: "MEMORY + RAG",    center: [120, 0, 40] },
  graph:        { color: "#ffb020", label: "3D GRAPH",        center: [0, -120, 0] },
  schedule:     { color: "#ffd166", label: "SCHEDULED TASKS", center: [120, 100, -40] },
  integrations: { color: "#ff5d8f", label: "INTEGRATIONS",    center: [-120, -80, 40] },
  database:     { color: "#44ddbb", label: "DATABASE",        center: [100, -80, -60] },
  frontend:     { color: "#88aaff", label: "FRONTEND",        center: [-60, -120, -40] },
};
const KIND_COLOR: Record<string,string> = {
  ai:"#c49fff", api:"#4aa3ff", service:"#88aaff", database:"#44ddbb",
  table:"#66ccaa", data:"#7dd87d", task:"#ffd166", integration:"#ff5d8f",
};

function buildTopology() {
  const j = (c: number, r: number) => c + (Math.random() - 0.5) * r;
  const mk = (id:string, label:string, kind:string, group:string, size:number): SysNode => {
    const g = GROUPS[group]; return { id,label,kind,group,size, x:j(g.center[0],60), y:j(g.center[1],60), z:j(g.center[2],60) };
  };
  const nodes: SysNode[] = [
    mk("brain-opus","Claude Opus 4.6","ai","brain",18), mk("brain-haiku","Claude Haiku 4.5","ai","brain",10),
    mk("brain-router","Agent Router","service","brain",12), mk("brain-tools","Tool Registry","service","brain",8),
    mk("brain-sdk","Agent SDK","service","brain",14),
    mk("voice-rt","OpenAI Realtime","api","voice",16), mk("voice-bridge","Voice Bridge","service","voice",10),
    mk("voice-vad","Semantic VAD","service","voice",7), mk("voice-tts","TTS Engine","service","voice",9),
    mk("voice-asr","Speech Recognition","service","voice",9),
    mk("mem-pgv","pgvector Search","database","memory",14), mk("mem-emb","Embeddings (1536d)","service","memory",10),
    mk("mem-chunks","Memory Chunks","data","memory",12), mk("mem-recall","Semantic Recall","service","memory",8),
    mk("db-pg","PostgreSQL","database","database",18), mk("db-users","users","table","database",6),
    mk("db-conv","conversations","table","database",10), mk("db-lessons","lessons_learned","table","database",12),
    mk("db-trends","trend_reports","table","database",10), mk("db-gn","graph_nodes","table","database",8),
    mk("db-ge","graph_edges","table","database",6), mk("db-mc","memory_chunks","table","database",10),
    mk("g3d","3D Force Graph","service","graph",14), mk("g-scan","File Scanner","service","graph",10),
    mk("g-watch","File Watcher","service","graph",8), mk("g-ws","WebSocket Bus","service","graph",10),
    mk("s-les","Lessons Daily","task","schedule",12), mk("s-tre","Trends Daily","task","schedule",12),
    mk("s-cron","APScheduler","service","schedule",8),
    mk("i-gh","GitHub","integration","integrations",12), mk("i-gm","Gmail","integration","integrations",10),
    mk("i-sl","Slack","integration","integrations",10), mk("i-st","Stripe","integration","integrations",10),
    mk("i-li","Linear","integration","integrations",8),
    mk("fe-react","React App","service","frontend",12), mk("fe-vite","Vite","service","frontend",8),
    mk("fe-vui","Voice Panel","service","frontend",10), mk("fe-gui","Graph Renderer","service","frontend",10),
  ];
  const links: SysLink[] = [
    {source:"brain-sdk",target:"brain-opus",kind:"uses"},{source:"brain-sdk",target:"brain-haiku",kind:"uses"},
    {source:"brain-router",target:"brain-sdk",kind:"routes"},{source:"brain-tools",target:"brain-sdk",kind:"provides"},
    {source:"voice-bridge",target:"brain-router",kind:"sends"},{source:"voice-rt",target:"voice-bridge",kind:"streams"},
    {source:"voice-vad",target:"voice-rt",kind:"detects"},{source:"voice-tts",target:"voice-rt",kind:"speaks"},
    {source:"voice-asr",target:"voice-rt",kind:"transcribes"},
    {source:"brain-haiku",target:"mem-recall",kind:"queries"},{source:"mem-recall",target:"mem-pgv",kind:"searches"},
    {source:"mem-emb",target:"mem-chunks",kind:"indexes"},{source:"mem-pgv",target:"db-mc",kind:"reads"},
    {source:"db-pg",target:"db-users",kind:"has"},{source:"db-pg",target:"db-conv",kind:"has"},
    {source:"db-pg",target:"db-lessons",kind:"has"},{source:"db-pg",target:"db-trends",kind:"has"},
    {source:"db-pg",target:"db-gn",kind:"has"},{source:"db-pg",target:"db-ge",kind:"has"},
    {source:"db-pg",target:"db-mc",kind:"has"},
    {source:"g3d",target:"g-ws",kind:"subscribes"},{source:"g-scan",target:"g-ws",kind:"emits"},
    {source:"g-watch",target:"g-scan",kind:"triggers"},{source:"g-ws",target:"fe-gui",kind:"streams"},
    {source:"s-les",target:"db-lessons",kind:"writes"},{source:"s-tre",target:"db-trends",kind:"writes"},
    {source:"s-cron",target:"s-les",kind:"triggers"},{source:"s-cron",target:"s-tre",kind:"triggers"},
    {source:"s-les",target:"brain-opus",kind:"calls"},{source:"s-tre",target:"brain-opus",kind:"calls"},
    {source:"fe-react",target:"fe-vite",kind:"built-by"},{source:"fe-vui",target:"voice-bridge",kind:"connects"},
    {source:"fe-gui",target:"g3d",kind:"renders"},
    {source:"i-gh",target:"brain-tools",kind:"tool"},{source:"i-gm",target:"brain-tools",kind:"tool"},
    {source:"i-sl",target:"brain-tools",kind:"tool"},{source:"i-st",target:"brain-tools",kind:"tool"},
    {source:"i-li",target:"brain-tools",kind:"tool"},
    {source:"brain-router",target:"db-conv",kind:"logs"},{source:"mem-chunks",target:"db-pg",kind:"stores"},
  ];
  return { nodes, links };
}

const WS_URL = (import.meta.env.VITE_BACKEND_WS ?? "ws://localhost:8000") + "/ws/graph";

export function Graph3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("initializing...");

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;
    let graph: any;
    try {
      const { nodes, links } = buildTopology();
      graph = ForceGraph3D()(el)
        .backgroundColor("#05070d").width(el.clientWidth).height(el.clientHeight)
        .graphData({ nodes, links })
        .nodeLabel((n:any)=>`<div style="background:rgba(0,0,0,0.85);padding:4px 10px;border-radius:6px;font-size:11px;color:#eee;border:1px solid ${KIND_COLOR[n.kind]??"#88aaff"};pointer-events:none"><b>${n.label}</b><br/><span style="opacity:0.5;font-size:9px">${n.group} · ${n.kind}</span></div>`)
        .nodeColor((n:any)=>{
          if(n.__pulse&&Date.now()-n.__pulse<1500){const t=(Date.now()-n.__pulse)/1500;return t<0.4?"#ffffff":(n.__pulseColor??KIND_COLOR[n.kind]??"#88aaff");}
          return KIND_COLOR[n.kind]??"#88aaff";
        })
        .nodeRelSize(1).nodeVal((n:any)=>{const b=(n.size??8)**1.8;return(n.__pulse&&Date.now()-n.__pulse<1000)?b*2:b;})
        .nodeOpacity(0.9)
        .linkColor((l:any)=>{
          const s:any=typeof l.source==="object"?l.source:null,t:any=typeof l.target==="object"?l.target:null;
          if((s?.__pulse&&Date.now()-s.__pulse<1200)||(t?.__pulse&&Date.now()-t.__pulse<1200))return"#ffffff66";
          return"rgba(100,140,220,0.12)";
        })
        .linkWidth((l:any)=>{
          const s:any=typeof l.source==="object"?l.source:null,t:any=typeof l.target==="object"?l.target:null;
          return((s?.__pulse&&Date.now()-s.__pulse<1200)||(t?.__pulse&&Date.now()-t.__pulse<1200))?2.5:0.3;
        })
        .linkDirectionalParticles((l:any)=>{
          const s:any=typeof l.source==="object"?l.source:null,t:any=typeof l.target==="object"?l.target:null;
          return((s?.__pulse&&Date.now()-s.__pulse<2000)||(t?.__pulse&&Date.now()-t.__pulse<2000))?5:0;
        })
        .linkDirectionalParticleWidth(2.5).linkDirectionalParticleSpeed(0.025).linkDirectionalParticleColor(()=>"#ffffff")
        .d3AlphaDecay(0.015).d3VelocityDecay(0.35).warmupTicks(80).cooldownTime(4000);

      setTimeout(()=>graph.cameraPosition({x:280,y:200,z:280},{x:0,y:0,z:0},2000),100);

      let angle=0;
      const rotateLoop=setInterval(()=>{if(!graph)return;angle+=0.0015;const d=340;
        graph.cameraPosition({x:d*Math.sin(angle),y:120+50*Math.sin(angle*0.4),z:d*Math.cos(angle)});
      },50);

      // WebSocket
      let ws:WebSocket|null=null;
      try{
        ws=new WebSocket(WS_URL);
        ws.onopen=()=>setStatus("live");
        ws.onmessage=(ev)=>{try{
          const msg=JSON.parse(ev.data);
          if(msg.type==="pulse"){
            const gd=graph.graphData();
            const tgt=gd.nodes.find((n:any)=>n.id===msg.node_id||n.label?.toLowerCase().includes((msg.label??"").toLowerCase().slice(0,12)));
            if(tgt){tgt.__pulse=Date.now();tgt.__pulseColor=GROUPS[tgt.group]?.color??"#ffffff";}
            const br=gd.nodes.find((n:any)=>n.id==="brain-opus");
            if(br){br.__pulse=Date.now();br.__pulseColor="#c49fff";}
          }
        }catch{}};
        ws.onerror=()=>setStatus("ws error");ws.onclose=()=>setStatus("disconnected");
      }catch{setStatus("offline");}

      // Pulse refresh
      const pulseLoop=setInterval(()=>{if(!graph)return;
        graph.nodeColor(graph.nodeColor());graph.linkColor(graph.linkColor());
        graph.linkWidth(graph.linkWidth());graph.linkDirectionalParticles(graph.linkDirectionalParticles());
        graph.nodeVal(graph.nodeVal());
      },100);

      // Demo pulses — system looks alive even idle
      const demoLoop=setInterval(()=>{
        const gd=graph.graphData();if(!gd.nodes.length)return;
        const count=1+Math.floor(Math.random()*3);
        for(let i=0;i<count;i++){const n=gd.nodes[Math.floor(Math.random()*gd.nodes.length)];
          n.__pulse=Date.now();n.__pulseColor=GROUPS[n.group]?.color??"#fff";}
      },2500);

      setStatus("live");
      const handleResize=()=>{if(el&&graph)graph.width(el.clientWidth).height(el.clientHeight);};
      window.addEventListener("resize",handleResize);
      return()=>{window.removeEventListener("resize",handleResize);clearInterval(rotateLoop);clearInterval(pulseLoop);clearInterval(demoLoop);ws?.close();};
    }catch(e){console.error("Graph3D fatal:",e);setStatus("failed");}
  },[]);

  return(
    <div ref={mountRef} style={{width:"100%",height:"100%",position:"relative"}}>
      <div style={{position:"absolute",top:0,right:0,padding:"14px 16px",zIndex:2,pointerEvents:"none"}}>
        {Object.entries(GROUPS).map(([k,g])=>(
          <div key={k} style={{fontSize:10,fontWeight:700,letterSpacing:2,color:g.color,opacity:0.7,marginBottom:6,textTransform:"uppercase",textAlign:"right"}}>
            <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",backgroundColor:g.color,marginRight:6,verticalAlign:"middle",boxShadow:`0 0 6px ${g.color}`}}/>
            {g.label}
          </div>
        ))}
      </div>
      <div style={{position:"absolute",bottom:8,right:12,fontSize:10,opacity:0.3,pointerEvents:"none",zIndex:5}}>{status}</div>
    </div>
  );
}
