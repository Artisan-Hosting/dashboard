(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[218],{315:(e,t,a)=>{(window.__NEXT_P=window.__NEXT_P||[]).push(["/apps/[id]",function(){return a(9323)}])},1059:(e,t,a)=>{"use strict";async function s(e){let t=await fetch("".concat("http://localhost:3800/api","/").concat(e),{method:"GET",credentials:"include",headers:{"Content-Type":"application/json"}});if(!t.ok){let e=await t.text();throw Error("API Error: ".concat(t.status," ").concat(e))}return t.json()}async function r(e){var t;let a=await fetch("".concat("http://localhost:3800/api","/proxy/billing/calculate?instances=").concat(e.instances),{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!a.ok){let e=await a.text();throw Error("API Error: ".concat(a.status," ").concat(e))}let s=await a.json();if(null==(t=s.errors)?void 0:t.length)throw Error(s.errors.map(e=>e.message).join("; "));return s.data}async function o(e,t){let a=await s("proxy/vms/".concat(e,"/").concat(t));if("ok"!==a.status)throw Error(a.errors.join(", "))}async function i(){let e=await s("proxy/vms");if("ok"!==e.status||!e.data)throw Error(e.errors.join(", "));return e.data}a.d(t,{QQ:()=>i,Y_:()=>r,mU:()=>o,v$:()=>s})},1713:(e,t,a)=>{"use strict";a.d(t,{A:()=>u});var s=a(4232);let r=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),o=e=>e.replace(/^([A-Z])|[\s-_]+(\w)/g,(e,t,a)=>a?a.toUpperCase():t.toLowerCase()),i=e=>{let t=o(e);return t.charAt(0).toUpperCase()+t.slice(1)},l=function(){for(var e=arguments.length,t=Array(e),a=0;a<e;a++)t[a]=arguments[a];return t.filter((e,t,a)=>!!e&&""!==e.trim()&&a.indexOf(e)===t).join(" ").trim()},n=e=>{for(let t in e)if(t.startsWith("aria-")||"role"===t||"title"===t)return!0};var c={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};let d=(0,s.forwardRef)((e,t)=>{let{color:a="currentColor",size:r=24,strokeWidth:o=2,absoluteStrokeWidth:i,className:d="",children:u,iconNode:p,...m}=e;return(0,s.createElement)("svg",{ref:t,...c,width:r,height:r,stroke:a,strokeWidth:i?24*Number(o)/Number(r):o,className:l("lucide",d),...!u&&!n(m)&&{"aria-hidden":"true"},...m},[...p.map(e=>{let[t,a]=e;return(0,s.createElement)(t,a)}),...Array.isArray(u)?u:[u]])}),u=(e,t)=>{let a=(0,s.forwardRef)((a,o)=>{let{className:n,...c}=a;return(0,s.createElement)(d,{ref:o,iconNode:t,className:l("lucide-".concat(r(i(e))),"lucide-".concat(e),n),...c})});return a.displayName=i(e),a}},1799:(e,t,a)=>{"use strict";a.d(t,{u:()=>i,v:()=>o});var s=a(9099),r=a.n(s);async function o(){await fetch("".concat("http://localhost:3800/api","/auth/logout"),{method:"POST",credentials:"include"}),r().push("/")}async function i(){await fetch("".concat("http://localhost:3800/api","/auth/logout_all"),{method:"POST",credentials:"include"}),r().push("/")}},2164:(e,t,a)=>{"use strict";a.d(t,{J:()=>r});var s=a(4232);function r(){let[e,t]=(0,s.useState)(""),[a,r]=(0,s.useState)(""),[o,i]=(0,s.useState)(!0),[l,n]=(0,s.useState)(null);return(0,s.useEffect)(()=>{let e=!0;return async function(){try{let a=await fetch("".concat("http://localhost:3800/api","/auth/me"),{method:"GET",credentials:"include",headers:{"Content-Type":"application/json"}}),s=await a.json();e&&s&&(t(s.user_id),r(s.email))}catch(t){e&&n(t)}finally{e&&i(!1)}}(),()=>{e=!1}},[]),{username:e,email:a,isLoading:o,error:l}}},3217:(e,t,a)=>{"use strict";a.d(t,{B:()=>c});var s=a(7876),r=a(9099),o=a(4232);let i=(0,a(1713).A)("x",[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]]);var l=a(8447),n=a(2164);function c(e){let{onLogout:t,onLogoutAll:a}=e,c=(0,r.useRouter)(),{username:d,email:u,isLoading:p,error:m}=(0,n.J)(),[h,x]=(0,o.useState)(""),[f,g]=(0,o.useState)(!1),[y,b]=(0,o.useState)(!1);return(0,o.useEffect)(()=>{!p&&u&&x(u)},[p,u]),(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)("div",{className:"lg:hidden fixed top-4 right-4 z-50",children:(0,s.jsx)("button",{onClick:()=>g(!f),className:"text-white bg-brand-gradient p-2 rounded shadow","aria-label":"Toggle sidebar",children:f?(0,s.jsx)(i,{className:"w-6 h-6"}):(0,s.jsx)(l.A,{className:"w-6 h-6"})})}),(0,s.jsxs)("aside",{className:"bg-brand-gradient text-white p-6 shadow-xl flex flex-col lg:static fixed top-0 left-0 h-full w-64 z-40 transform transition-transform duration-300 lg:translate-x-0 ".concat(f?"translate-x-0":"-translate-x-full"," lg:min-h-screen"),children:[(0,s.jsxs)("div",{className:"relative mb-6",children:[(0,s.jsx)("div",{className:"bg-white/10 p-4 rounded-xl cursor-pointer hover:bg-white/20 transition",onClick:()=>b(!y),children:(0,s.jsxs)("div",{className:"flex items-center space-x-3",children:[(0,s.jsx)("img",{src:"https://api.dicebear.com/7.x/identicon/svg?seed=".concat(encodeURIComponent(d||"placeholder")),alt:"Profile",className:"w-12 h-12 rounded-full border border-brand"}),(0,s.jsxs)("div",{className:"max-w-full overflow-hidden",children:[(0,s.jsx)("div",{className:"text-white text-sm font-semibold truncate",children:d}),(0,s.jsx)("div",{className:"text-xs text-gray-300 break-all",children:h})]})]})}),y&&(0,s.jsxs)("div",{className:"absolute left-0 mt-2 w-full bg-gray-900 rounded shadow-lg z-50 flex flex-col text-sm",children:[(0,s.jsx)("button",{onClick:()=>{c.push("/account"),b(!1)},className:"px-4 py-2 text-left hover:bg-gray-700",children:"Account"}),(0,s.jsx)("button",{onClick:()=>{t(),b(!1)},className:"px-4 py-2 text-left text-red-400 hover:bg-gray-700",children:"Logout"})]})]}),(0,s.jsxs)("nav",{className:"flex flex-col space-y-4 text-gray-300 text-sm",children:[(0,s.jsx)("button",{onClick:()=>c.push("/apps"),className:"text-left hover:text-brand",children:"Apps"}),(0,s.jsx)("button",{onClick:()=>c.push("/vms"),className:"text-left hover:text-brand",children:"Vms"}),(0,s.jsx)("button",{onClick:()=>c.push("/secrets"),className:"text-left hover:text-brand",children:"Secrets"}),(0,s.jsx)("button",{onClick:()=>c.push("/billing"),className:"text-left hover:text-brand",children:"Billing"}),(0,s.jsx)("div",{className:"mt-auto"})]})]})]})}},3780:(e,t,a)=>{"use strict";a.d(t,{A:()=>r});var s=a(7876);function r(){return(0,s.jsx)("div",{className:"absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-sm bg-white/80 dark:bg-gray-900/60",children:(0,s.jsx)("p",{className:"mt-6 text-gray-700 dark:text-gray-300 text-lg font-medium",children:"Loading data…"})})}a(4232)},8447:(e,t,a)=>{"use strict";a.d(t,{A:()=>s});let s=(0,a(1713).A)("menu",[["path",{d:"M4 12h16",key:"1lakjw"}],["path",{d:"M4 18h16",key:"19g7jn"}],["path",{d:"M4 6h16",key:"1o0s65"}]])},9099:(e,t,a)=>{e.exports=a(8253)},9323:(e,t,a)=>{"use strict";a.r(t),a.d(t,{default:()=>ev,truncate:()=>eb});var s,r=a(7876),o=a(3217),i=a(3780),l=a(1059),n=a(1799);let c={Running:"text-green-400",Stopped:"text-red-400",Warning:"text-yellow-400",Building:"text-blue-400"};var d=a(9099),u=a(4232),p=a(8447);let m={data:""},h=e=>"object"==typeof window?((e?e.querySelector("#_goober"):window._goober)||Object.assign((e||document.head).appendChild(document.createElement("style")),{innerHTML:" ",id:"_goober"})).firstChild:e||m,x=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,f=/\/\*[^]*?\*\/|  +/g,g=/\n+/g,y=(e,t)=>{let a="",s="",r="";for(let o in e){let i=e[o];"@"==o[0]?"i"==o[1]?a=o+" "+i+";":s+="f"==o[1]?y(i,o):o+"{"+y(i,"k"==o[1]?"":t)+"}":"object"==typeof i?s+=y(i,t?t.replace(/([^,])+/g,e=>o.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):o):null!=i&&(o=/^--/.test(o)?o:o.replace(/[A-Z]/g,"-$&").toLowerCase(),r+=y.p?y.p(o,i):o+":"+i+";")}return a+(t&&r?t+"{"+r+"}":r)+s},b={},v=e=>{if("object"==typeof e){let t="";for(let a in e)t+=a+v(e[a]);return t}return e},w=(e,t,a,s,r)=>{let o=v(e),i=b[o]||(b[o]=(e=>{let t=0,a=11;for(;t<e.length;)a=101*a+e.charCodeAt(t++)>>>0;return"go"+a})(o));if(!b[i]){let t=o!==e?e:(e=>{let t,a,s=[{}];for(;t=x.exec(e.replace(f,""));)t[4]?s.shift():t[3]?(a=t[3].replace(g," ").trim(),s.unshift(s[0][a]=s[0][a]||{})):s[0][t[1]]=t[2].replace(g," ").trim();return s[0]})(e);b[i]=y(r?{["@keyframes "+i]:t}:t,a?"":"."+i)}let l=a&&b.g?b.g:null;return a&&(b.g=b[i]),((e,t,a,s)=>{s?t.data=t.data.replace(s,e):-1===t.data.indexOf(e)&&(t.data=a?e+t.data:t.data+e)})(b[i],t,s,l),i},j=(e,t,a)=>e.reduce((e,s,r)=>{let o=t[r];if(o&&o.call){let e=o(a),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;o=t?"."+t:e&&"object"==typeof e?e.props?"":y(e,""):!1===e?"":e}return e+s+(null==o?"":o)},"");function N(e){let t=this||{},a=e.call?e(t.p):e;return w(a.unshift?a.raw?j(a,[].slice.call(arguments,1),t.p):a.reduce((e,a)=>Object.assign(e,a&&a.call?a(t.p):a),{}):a,h(t.target),t.g,t.o,t.k)}N.bind({g:1});let k,E,C,S=N.bind({k:1});function _(e,t){let a=this||{};return function(){let s=arguments;function r(o,i){let l=Object.assign({},o),n=l.className||r.className;a.p=Object.assign({theme:E&&E()},l),a.o=/ *go\d+/.test(n),l.className=N.apply(a,s)+(n?" "+n:""),t&&(l.ref=i);let c=e;return e[0]&&(c=l.as||e,delete l.as),C&&c[0]&&C(l),k(c,l)}return t?t(r):r}}var A=e=>"function"==typeof e,$=(e,t)=>A(e)?e(t):e,P=(()=>{let e=0;return()=>(++e).toString()})(),T=(()=>{let e;return()=>{if(void 0===e&&"u">typeof window){let t=matchMedia("(prefers-reduced-motion: reduce)");e=!t||t.matches}return e}})(),M=(e,t)=>{switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,20)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:a}=t;return M(e,{type:+!!e.toasts.find(e=>e.id===a.id),toast:a});case 3:let{toastId:s}=t;return{...e,toasts:e.toasts.map(e=>e.id===s||void 0===s?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let r=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+r}))}}},O=[],F={toasts:[],pausedAt:void 0},R=e=>{F=M(F,e),O.forEach(e=>{e(F)})},B={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},z=(e={})=>{let[t,a]=(0,u.useState)(F),s=(0,u.useRef)(F);(0,u.useEffect)(()=>(s.current!==F&&a(F),O.push(a),()=>{let e=O.indexOf(a);e>-1&&O.splice(e,1)}),[]);let r=t.toasts.map(t=>{var a,s,r;return{...e,...e[t.type],...t,removeDelay:t.removeDelay||(null==(a=e[t.type])?void 0:a.removeDelay)||(null==e?void 0:e.removeDelay),duration:t.duration||(null==(s=e[t.type])?void 0:s.duration)||(null==e?void 0:e.duration)||B[t.type],style:{...e.style,...null==(r=e[t.type])?void 0:r.style,...t.style}}});return{...t,toasts:r}},D=(e,t="blank",a)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...a,id:(null==a?void 0:a.id)||P()}),I=e=>(t,a)=>{let s=D(t,e,a);return R({type:2,toast:s}),s.id},L=(e,t)=>I("blank")(e,t);L.error=I("error"),L.success=I("success"),L.loading=I("loading"),L.custom=I("custom"),L.dismiss=e=>{R({type:3,toastId:e})},L.remove=e=>R({type:4,toastId:e}),L.promise=(e,t,a)=>{let s=L.loading(t.loading,{...a,...null==a?void 0:a.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let r=t.success?$(t.success,e):void 0;return r?L.success(r,{id:s,...a,...null==a?void 0:a.success}):L.dismiss(s),e}).catch(e=>{let r=t.error?$(t.error,e):void 0;r?L.error(r,{id:s,...a,...null==a?void 0:a.error}):L.dismiss(s)}),e};var U=(e,t)=>{R({type:1,toast:{id:e,height:t}})},H=()=>{R({type:5,time:Date.now()})},W=new Map,X=1e3,G=(e,t=X)=>{if(W.has(e))return;let a=setTimeout(()=>{W.delete(e),R({type:4,toastId:e})},t);W.set(e,a)},J=e=>{let{toasts:t,pausedAt:a}=z(e);(0,u.useEffect)(()=>{if(a)return;let e=Date.now(),s=t.map(t=>{if(t.duration===1/0)return;let a=(t.duration||0)+t.pauseDuration-(e-t.createdAt);if(a<0){t.visible&&L.dismiss(t.id);return}return setTimeout(()=>L.dismiss(t.id),a)});return()=>{s.forEach(e=>e&&clearTimeout(e))}},[t,a]);let s=(0,u.useCallback)(()=>{a&&R({type:6,time:Date.now()})},[a]),r=(0,u.useCallback)((e,a)=>{let{reverseOrder:s=!1,gutter:r=8,defaultPosition:o}=a||{},i=t.filter(t=>(t.position||o)===(e.position||o)&&t.height),l=i.findIndex(t=>t.id===e.id),n=i.filter((e,t)=>t<l&&e.visible).length;return i.filter(e=>e.visible).slice(...s?[n+1]:[0,n]).reduce((e,t)=>e+(t.height||0)+r,0)},[t]);return(0,u.useEffect)(()=>{t.forEach(e=>{if(e.dismissed)G(e.id,e.removeDelay);else{let t=W.get(e.id);t&&(clearTimeout(t),W.delete(e.id))}})},[t]),{toasts:t,handlers:{updateHeight:U,startPause:H,endPause:s,calculateOffset:r}}},Z=S`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,q=S`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,Q=S`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,Y=_("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${Z} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${q} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${Q} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,K=S`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,V=_("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${K} 1s linear infinite;
`,ee=S`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,et=S`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,ea=_("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${ee} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${et} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,es=_("div")`
  position: absolute;
`,er=_("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,eo=S`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,ei=_("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${eo} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,el=({toast:e})=>{let{icon:t,type:a,iconTheme:s}=e;return void 0!==t?"string"==typeof t?u.createElement(ei,null,t):t:"blank"===a?null:u.createElement(er,null,u.createElement(V,{...s}),"loading"!==a&&u.createElement(es,null,"error"===a?u.createElement(Y,{...s}):u.createElement(ea,{...s})))},en=e=>`
0% {transform: translate3d(0,${-200*e}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,ec=e=>`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*e}%,-1px) scale(.6); opacity:0;}
`,ed=_("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,eu=_("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,ep=(e,t)=>{let a=e.includes("top")?1:-1,[s,r]=T()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[en(a),ec(a)];return{animation:t?`${S(s)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${S(r)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}},em=u.memo(({toast:e,position:t,style:a,children:s})=>{let r=e.height?ep(e.position||t||"top-center",e.visible):{opacity:0},o=u.createElement(el,{toast:e}),i=u.createElement(eu,{...e.ariaProps},$(e.message,e));return u.createElement(ed,{className:e.className,style:{...r,...a,...e.style}},"function"==typeof s?s({icon:o,message:i}):u.createElement(u.Fragment,null,o,i))});s=u.createElement,y.p=void 0,k=s,E=void 0,C=void 0;var eh=({id:e,className:t,style:a,onHeightUpdate:s,children:r})=>{let o=u.useCallback(t=>{if(t){let a=()=>{s(e,t.getBoundingClientRect().height)};a(),new MutationObserver(a).observe(t,{subtree:!0,childList:!0,characterData:!0})}},[e,s]);return u.createElement("div",{ref:o,className:t,style:a},r)},ex=(e,t)=>{let a=e.includes("top"),s=e.includes("center")?{justifyContent:"center"}:e.includes("right")?{justifyContent:"flex-end"}:{};return{left:0,right:0,display:"flex",position:"absolute",transition:T()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${t*(a?1:-1)}px)`,...a?{top:0}:{bottom:0},...s}},ef=N`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,eg=({reverseOrder:e,position:t="top-center",toastOptions:a,gutter:s,children:r,containerStyle:o,containerClassName:i})=>{let{toasts:l,handlers:n}=J(a);return u.createElement("div",{id:"_rht_toaster",style:{position:"fixed",zIndex:9999,top:16,left:16,right:16,bottom:16,pointerEvents:"none",...o},className:i,onMouseEnter:n.startPause,onMouseLeave:n.endPause},l.map(a=>{let o=a.position||t,i=ex(o,n.calculateOffset(a,{reverseOrder:e,gutter:s,defaultPosition:t}));return u.createElement(eh,{id:a.id,key:a.id,onHeightUpdate:n.updateHeight,className:a.visible?ef:"",style:i},"custom"===a.type?$(a.message,a):r?r(a):u.createElement(em,{toast:a,position:o}))}))};function ey(e){if(0===e)return"0 B";let t=Math.floor(Math.log(e)/Math.log(1024));return"".concat((e/Math.pow(1024,t)).toFixed(2)," ").concat(["B","KB","MB","GB","TB"][t])}let eb=function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:10;return e.length>t?e.slice(12,t)+"…":e};function ev(){let e=(0,d.useRouter)(),{id:t}=e.query,[a,s]=(0,u.useState)([]),[m,h]=(0,u.useState)([]),[x,f]=(0,u.useState)(null),[g,y]=(0,u.useState)({}),[b,v]=(0,u.useState)(null),[w,j]=(0,u.useState)({}),[N,k]=(0,u.useState)(!0),[E,C]=(0,u.useState)(""),S=(0,u.useRef)({}),[_,A]=(0,u.useState)(null),$=async(e,t)=>{try{let a=await (0,l.v$)("proxy/control/".concat(e,"/").concat(t));L.success("".concat(t," sent to ").concat(e)),console.log("".concat(t," sent to ").concat(e),a)}catch(a){L.error("Failed to send ".concat(t," to ").concat(e)),console.error("Failed to send command '".concat(t,"' to ").concat(e),a)}};return(0,u.useEffect)(()=>{e.isReady&&t&&(async()=>{try{let e=(await (0,l.v$)("proxy/runner/".concat(t))).data||[];h(e);let a=(await (0,l.v$)("proxy/usage/group/".concat(t))).data;f(a);let r=await Promise.all(e.map(async e=>{let t=await (0,l.v$)("proxy/usage/single/".concat(e.id));return{details:e,usage:t.data}}));s(r);let o={};await Promise.all(e.map(async e=>{try{var t;let a=await (0,l.v$)("proxy/logs/".concat(e.id,"/500"));o[e.id]=(null==(t=a.data)?void 0:t.lines)||[]}catch(t){console.error("Failed logs for ".concat(e.id),t)}})),j(o)}catch(e){console.error("Error loading runner + usage:",e)}finally{k(!1)}})()},[e.isReady,t]),(0,u.useEffect)(()=>{let e,a=async()=>{try{let e=await Promise.all(m.map(async e=>{let a=((await (0,l.v$)("proxy/runner/".concat(t))).data||[]).find(t=>t.id===e.id)||e,s=await (0,l.v$)("proxy/usage/single/".concat(e.id));return{details:a,usage:s.data}})),a=S.current;e.forEach(e=>{let{details:t}=e,s=a[t.id];s&&s!==t.status&&L("Status changed: ".concat(t.id," is now ").concat(t.status),{icon:"Running"===t.status?"✅":"⚠️"}),a[t.id]=t.status}),s(e),C(new Date().toLocaleTimeString());let r={};await Promise.all(m.map(async e=>{try{var t;let a=await (0,l.v$)("proxy/logs/".concat(e.id,"/100"));r[e.id]=(null==(t=a.data)?void 0:t.lines)||[]}catch(t){console.error("Polling failed logs for ".concat(e.id),t)}})),j(r)}catch(e){console.error("Polling error:",e)}};return a(),e=setInterval(a,5e3),()=>clearInterval(e)},[t,m]),(0,r.jsxs)("div",{className:"relative min-h-screen flex bg-page text-foreground",children:[(0,r.jsx)(eg,{position:"bottom-right"}),(0,r.jsx)(o.B,{onLogout:n.v,onLogoutAll:n.u}),(0,r.jsxs)("main",{className:"flex-1 overflow-y-auto p-4 sm:p-6",children:[(0,r.jsxs)("h1",{className:"text-3xl font-bold text-brand mb-6",children:["Project: ",t]}),!N&&(0,r.jsx)("div",{className:"grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3",children:a.map(e=>{var t,a,s,o,i,l,n,d;let{details:u,usage:m}=e;g[u.id];let h=w[u.id]||[];return(0,r.jsxs)("div",{className:"card p-4",children:[(0,r.jsxs)("div",{className:"flex justify-between items-center mb-2",children:[(0,r.jsxs)("div",{children:[(0,r.jsx)("h2",{className:"text-xl font-semibold text-brand text-pretty",children:eb(String(u.id),24)||"huh"}),(0,r.jsx)("p",{className:"text-sm ".concat(c[u.status]||"text-black"),children:u.status})]}),(0,r.jsxs)("div",{className:"hidden sm:flex gap-2",children:[(0,r.jsx)("button",{onClick:()=>$(u.id,"start"),className:"bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-white text-sm",children:"Start"}),(0,r.jsx)("button",{onClick:()=>$(u.id,"stop"),className:"bg-yellow-500 hover:bg-yellow-600 px-2 py-1 rounded text-white text-sm",children:"Stop"}),(0,r.jsx)("button",{onClick:()=>$(u.id,"restart"),className:"bg-brand hover:bg-brand-dark px-2 py-1 rounded text-white text-sm",children:"Restart"})]}),(0,r.jsxs)("div",{className:"relative sm:hidden",children:[(0,r.jsx)("button",{onClick:()=>A(_===u.id?null:u.id),className:"p-2 bg-brand rounded text-white",children:(0,r.jsx)(p.A,{className:"w-5 h-5"})}),_===u.id&&(0,r.jsxs)("div",{className:"absolute right-0 mt-2 bg-[#1b1e2e] p-2 rounded shadow-lg space-y-1 z-20",children:[(0,r.jsx)("button",{onClick:()=>{$(u.id,"start"),A(null)},className:"block w-full text-left px-2 py-1 rounded hover:bg-gray-700 text-sm",children:"Start"}),(0,r.jsx)("button",{onClick:()=>{$(u.id,"stop"),A(null)},className:"block w-full text-left px-2 py-1 rounded hover:bg-gray-700 text-sm",children:"Stop"}),(0,r.jsx)("button",{onClick:()=>{$(u.id,"restart"),A(null)},className:"block w-full text-left px-2 py-1 rounded hover:bg-gray-700 text-sm",children:"Restart"})]})]})]}),(0,r.jsxs)("div",{className:"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 text-sm text-gray-300",children:[(0,r.jsxs)("div",{className:"space-y-1",children:[(0,r.jsx)("h3",{className:"font-semibold text-brand",children:"Health"}),(0,r.jsxs)("p",{children:["CPU Usage: ",null!=(i=null==(t=u.health)?void 0:t.cpu_usage)?i:"N/A"]}),(0,r.jsxs)("p",{children:["RAM Usage: ",null!=(l=null==(a=u.health)?void 0:a.ram_usage)?l:"N/A"]}),(0,r.jsxs)("p",{children:["TX: ",ey(null!=(n=null==(s=u.health)?void 0:s.tx_bytes)?n:0)]}),(0,r.jsxs)("p",{children:["RX: ",ey(null!=(d=null==(o=u.health)?void 0:o.rx_bytes)?d:0)]})]}),(0,r.jsxs)("div",{className:"space-y-1",children:[(0,r.jsx)("h3",{className:"font-semibold text-brand",children:"Usage"}),(0,r.jsxs)("p",{children:["Total CPU Time: ",m.total_cpu.toFixed(3)," hrs"]}),(0,r.jsxs)("p",{children:["Avg Memory: ",m.avg_memory.toFixed(3)," MB"]}),(0,r.jsxs)("p",{children:["Peak Memory: ",m.peak_memory.toFixed(3)," MB"]})]})]}),h.length>0&&(0,r.jsxs)("details",{className:"mt-4",children:[(0,r.jsx)("summary",{className:"cursor-pointer font-semibold text-sm mb-2 text-brand",children:"Recent Logs"}),(0,r.jsx)("div",{className:"max-h-40 overflow-y-auto bg-black text-green-400 text-xs p-2 rounded border border-gray-700",children:h.map((e,t)=>(0,r.jsxs)("pre",{className:"whitespace-pre-wrap",children:["[",e.timestamp,"] ",e.message]},t))})]})]},u.id)})}),x&&!N&&b&&(0,r.jsxs)("div",{className:"mt-10 card p-6",children:[(0,r.jsx)("h2",{className:"text-xl font-bold mb-4 text-brand",children:"Overall Usage & Billing"}),(0,r.jsxs)("div",{className:"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",children:[(0,r.jsxs)("div",{className:"space-y-1 text-gray-300",children:[(0,r.jsxs)("p",{children:["Total CPU Time: ",x.total_cpu.toFixed(2)," hrs"]}),(0,r.jsxs)("p",{children:["Avg Memory:       ",x.avg_memory.toFixed(2)," MB"]}),(0,r.jsxs)("p",{children:["Total Instances:  ",a.length]}),(0,r.jsxs)("p",{children:["Samples:          ",x.total_samples]})]}),(0,r.jsxs)("div",{className:"space-y-1 text-gray-300",children:[(0,r.jsxs)("p",{children:["CPU Cost:      $",b.cpu_cost.toFixed(2)]}),(0,r.jsxs)("p",{children:["RAM Cost:      $",b.ram_cost.toFixed(2)]}),(0,r.jsxs)("p",{children:["Bandwidth:     $",b.bandwidth_cost.toFixed(2)]}),(0,r.jsxs)("p",{className:"font-semibold text-white",children:["Total Cost:    $",b.total_cost.toFixed(2)]})]})]})]})]}),N&&(0,r.jsx)(i.A,{})]})}}},e=>{var t=t=>e(e.s=t);e.O(0,[636,593,792],()=>t(315)),_N_E=e.O()}]);