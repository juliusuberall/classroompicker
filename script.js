(function(){
  "use strict";
  var KEY="cp.v1";
  var S={names:[],used:[],accent:"#6667AB",theme:"auto",groups:4,view:"pick"};
  var timer={left:300,on:false,id:null};

  var $=function(id){return document.getElementById(id)};
  var stage=$("stage"), nameOut=$("nameOut"), clockOut=$("clockOut"), groupsOut=$("groupsOut"),
      hint=$("stageHint"), mainBtn=$("mainBtn"), countEl=$("count"), setup=$("setup"),
      settings=$("settings"), controls=$("controls"), ta=$("names"),
      progress=$("progress"), progressFill=$("progressFill");

  /* ---------- storage ---------- */
  function load(){ try{var r=localStorage.getItem(KEY); if(r) Object.assign(S,JSON.parse(r));}catch(e){} }
  function save(){ try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){} }

  /* ---------- colour ---------- */
  function hex2rgb(h){h=h.replace("#","");if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  function lum(c){var a=c.map(function(v){v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
    return .2126*a[0]+.7152*a[1]+.0722*a[2];}
  function ratio(a,b){var l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);}
  function mix(c,t,amt){return c.map(function(v,i){return Math.round(v+(t[i]-v)*amt)});}
  function rgb2hex(c){return "#"+c.map(function(v){return ("0"+Math.max(0,Math.min(255,v)).toString(16)).slice(-2)}).join("");}
  /* nudge accent toward black (light theme) or white (dark theme) until it reads as text */
  function readable(hex,dark){
    var c=hex2rgb(hex), target=dark?[255,255,255]:[0,0,0], bg=dark?hex2rgb("#131318"):hex2rgb("#FBFBFD");
    for(var i=0;i<=10;i++){ var t=mix(c,target,i*0.07); if(ratio(t,bg)>=4.5) return rgb2hex(t); }
    return rgb2hex(mix(c,target,.7));
  }
  function isDark(){
    var t=document.documentElement.getAttribute("data-theme");
    if(t==="dark") return true; if(t==="light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function applyAccent(){
    var r=document.documentElement, a=S.accent;
    r.style.setProperty("--accent",a);
    r.style.setProperty("--accent-text",readable(a,isDark()));
    r.style.setProperty("--accent-soft",a+"22");
    r.style.setProperty("--accent-ring",a+"55");
    $("customC").value=a;
    [].forEach.call(document.querySelectorAll(".sw"),function(b){
      b.setAttribute("aria-pressed", b.dataset.c.toLowerCase()===a.toLowerCase()?"true":"false");
    });
  }
  function applyTheme(){
    if(S.theme==="auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme",S.theme);
    [].forEach.call($("themeSeg").children,function(b){
      b.setAttribute("aria-pressed", b.dataset.t===S.theme?"true":"false");
    });
    applyAccent();
  }

  /* ---------- names ---------- */
  function parse(txt){
    return txt.split(/[\n\r\t,;]+/).map(function(s){return s.trim()}).filter(Boolean);
  }
  function remaining(){
    return S.names.filter(function(n){return S.used.indexOf(n)<0});
  }

  /* ---------- render ---------- */
  function show(el){ [nameOut,clockOut,groupsOut,hint].forEach(function(e){e.classList.add("hidden")});
                     if(el) el.classList.remove("hidden"); }
  function render(){
    var has=S.names.length>0;
    setup.classList.toggle("hidden", has);
    controls.classList.toggle("hidden", !has);
    stage.classList.toggle("hidden", !has);
    $("editBtn").classList.toggle("hidden", !has);

    [].forEach.call($("nav").children,function(b){
      b.setAttribute("aria-current", b.dataset.view===S.view?"true":"false");
    });
    $("resetBtn").classList.toggle("hidden", S.view!=="pick");
    $("groupsField").classList.toggle("hidden", S.view!=="groups");

    if(!has){ show(null); progress.classList.add("hidden"); return; }

    if(S.view==="pick"){
      mainBtn.textContent="Pick a student";
      var left=remaining().length;
      countEl.innerHTML="<b>"+left+"</b> of "+S.names.length+" still to go";
      mainBtn.disabled = false;
      if(nameOut.textContent) show(nameOut);
      else if(left===0){ show(hint); hint.innerHTML="Everyone has had a turn. <b>Start over</b> to go again."; }
      else { show(hint); hint.innerHTML="Press <b>Pick</b> — or tap the spacebar"; }
      if(S.names.length){
        var pct=Math.round(left/S.names.length*100);
        progress.classList.remove("hidden");
        progressFill.style.width=pct+"%";
        progress.setAttribute("aria-valuenow",pct);
      } else progress.classList.add("hidden");
    }
    else if(S.view==="groups"){
      mainBtn.textContent="Make groups"; mainBtn.disabled=false; countEl.textContent=S.names.length+" students";
      if(groupsOut.children.length) show(groupsOut);
      else { show(hint); hint.innerHTML="Press <b>Make groups</b> to split the class"; }
      progress.classList.add("hidden");
    }
    else {
      mainBtn.textContent = timer.on ? "Pause" : "Start timer";
      mainBtn.disabled=false; countEl.textContent="";
      show(clockOut); drawClock();
      progress.classList.add("hidden");
    }
  }

  /* ---------- actions ---------- */
  function pick(){
    var pool=remaining();
    if(!pool.length){ S.used=[]; pool=remaining(); }
    if(!pool.length) return;
    var n=pool[Math.floor(Math.random()*pool.length)];
    S.used.push(n);
    nameOut.textContent=n; show(nameOut);
    nameOut.classList.remove("hit"); void nameOut.offsetWidth; nameOut.classList.add("hit");
    stage.classList.add("lit"); setTimeout(function(){stage.classList.remove("lit")},420);
    save(); render();
  }
  function makeGroups(){
    var a=S.names.slice();
    for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}
    var k=Math.max(2,Math.min(12,S.groups||4)), buckets=[];
    for(var g=0;g<k;g++) buckets.push([]);
    a.forEach(function(n,idx){ buckets[idx%k].push(n); });
    groupsOut.innerHTML="";
    buckets.forEach(function(b,i){
      if(!b.length) return;
      var d=document.createElement("div"); d.className="gcard";
      var h=document.createElement("h3"); h.textContent="Group "+(i+1); d.appendChild(h);
      var ul=document.createElement("ul");
      b.forEach(function(n){var li=document.createElement("li"); li.textContent=n; ul.appendChild(li);});
      d.appendChild(ul); groupsOut.appendChild(d);
    });
    show(groupsOut);
  }
  function drawClock(){
    var m=Math.floor(timer.left/60), s=timer.left%60;
    clockOut.textContent=(m<10?"0":"")+m+":"+(s<10?"0":"")+s;
    clockOut.classList.toggle("done", timer.left===0);
  }
  function toggleTimer(){
    if(timer.on){ clearInterval(timer.id); timer.on=false; }
    else {
      if(timer.left<=0) timer.left=300;
      timer.on=true;
      timer.id=setInterval(function(){
        timer.left--; if(timer.left<=0){ timer.left=0; clearInterval(timer.id); timer.on=false; render(); }
        drawClock();
      },1000);
    }
    render();
  }

  /* ---------- present ---------- */
  function present(on){
    document.body.classList.toggle("present", on);
    if(on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function(){});
    if(!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function(){});
  }

  /* ---------- events ---------- */
  $("saveBtn").onclick=function(){
    var list=parse(ta.value);
    if(!list.length){ ta.focus(); return; }
    S.names=list; S.used=[]; nameOut.textContent=""; save(); render();
  };
  $("demoBtn").onclick=function(){
    ta.value=["Amara Okafor","Ben Whitfield","Chloe Nguyen","Dev Patel","Elif Demir","Finn O'Leary",
      "Grace Adeyemi","Hugo Martins","Isla Robertson","Jonas Weber","Kavya Rao","Liam Byrne",
      "Maya Cohen","Noah Andersson","Olive Tran","Priya Shah","Quinn Harper","Rosa Delgado",
      "Sam Iwuchukwu","Tomas Novak","Uma Krishnan","Victor Silva","Wren Baxter","Yusuf Aziz"].join("\n");
    ta.focus();
  };
  $("editBtn").onclick=function(){
    ta.value=S.names.join("\n"); S.names=[]; nameOut.textContent=""; groupsOut.innerHTML="";
    save(); render(); ta.focus();
  };
  $("resetBtn").onclick=function(){ S.used=[]; nameOut.textContent=""; save(); render(); };
  mainBtn.onclick=function(){
    if(S.view==="pick") pick(); else if(S.view==="groups") makeGroups(); else toggleTimer();
  };
  $("nav").onclick=function(e){
    var b=e.target.closest("button[data-view]"); if(!b) return;
    S.view=b.dataset.view; save(); render();
  };
  $("presentBtn").onclick=function(){ present(true) };
  $("exitBtn").onclick=function(){ present(false) };
  $("setBtn").onclick=function(){
    var h=settings.classList.toggle("hidden");
    $("setBtn").setAttribute("aria-expanded", String(!h));
  };
  $("swatches").onclick=function(e){
    var b=e.target.closest(".sw"); if(!b) return;
    S.accent=b.dataset.c; save(); applyAccent();
  };
  $("customC").oninput=function(){ S.accent=this.value; save(); applyAccent(); };
  $("themeSeg").onclick=function(e){
    var b=e.target.closest("button[data-t]"); if(!b) return;
    S.theme=b.dataset.t; save(); applyTheme();
  };
  $("gCount").oninput=function(){ S.groups=parseInt(this.value,10)||4; save(); };
  stage.onclick=function(){ if(S.names.length && S.view==="pick") pick(); };

  document.addEventListener("keydown",function(e){
    if(/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    var k=e.key.toLowerCase();
    if(e.code==="Space"||k==="enter"){ e.preventDefault(); mainBtn.click(); }
    else if(k==="f"){ present(!document.body.classList.contains("present")); }
    else if(k==="escape"){ present(false); }
    else if(k==="r"){ $("resetBtn").click(); }
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",applyAccent);

  /* ---------- boot ---------- */
  load();
  $("gCount").value=S.groups;
  applyTheme();
  render();
})();
