(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[560],{672:(e,t,a)=>{"use strict";a.d(t,{A:()=>r});let r=(0,a(1713).A)("x",[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]])},767:(e,t,a)=>{"use strict";a.d(t,{B:()=>c});var r=a(7876),s=a(9099),o=a(4232),i=a(672),n=a(8447),l=a(2164);function c(e){let{onLogout:t,onLogoutAll:a}=e,c=(0,s.useRouter)(),{username:d,email:u,isLoading:p,error:m}=(0,l.J)(),[f,h]=(0,o.useState)(""),[g,y]=(0,o.useState)(!1),[x,b]=(0,o.useState)(!1);return(0,o.useEffect)(()=>{!p&&u&&h(u)},[p,u]),(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)("div",{className:"lg:hidden fixed top-4 right-4 z-50",children:(0,r.jsx)("button",{onClick:()=>y(!g),className:"text-white bg-brand-gradient p-2 rounded shadow","aria-label":"Toggle sidebar",children:g?(0,r.jsx)(i.A,{className:"w-6 h-6"}):(0,r.jsx)(n.A,{className:"w-6 h-6"})})}),(0,r.jsxs)("aside",{className:"bg-brand-gradient text-white p-6 shadow-xl flex flex-col lg:static fixed top-0 left-0 h-full w-64 z-40 transform transition-transform duration-300 lg:translate-x-0 ".concat(g?"translate-x-0":"-translate-x-full"," lg:min-h-screen"),children:[(0,r.jsxs)("div",{className:"relative mb-6",children:[(0,r.jsx)("div",{className:"bg-white/10 p-4 rounded-xl cursor-pointer hover:bg-white/20 transition",onClick:()=>b(!x),children:(0,r.jsxs)("div",{className:"flex items-center space-x-3",children:[(0,r.jsx)("img",{src:"https://api.dicebear.com/7.x/identicon/svg?seed=".concat(encodeURIComponent(d||"placeholder")),alt:"Profile",className:"w-12 h-12 rounded-full border border-brand"}),(0,r.jsxs)("div",{className:"max-w-full overflow-hidden",children:[(0,r.jsx)("div",{className:"text-white text-sm font-semibold truncate",children:d}),(0,r.jsx)("div",{className:"text-xs text-gray-300 break-all",children:f})]})]})}),x&&(0,r.jsxs)("div",{className:"absolute left-0 mt-2 w-full bg-gray-900 rounded shadow-lg z-50 flex flex-col text-sm",children:[(0,r.jsx)("button",{onClick:()=>{c.push("/account"),b(!1)},className:"px-4 py-2 text-left hover:bg-gray-700",children:"Account"}),(0,r.jsx)("button",{onClick:()=>{t(),b(!1)},className:"px-4 py-2 text-left text-red-400 hover:bg-gray-700",children:"Logout"})]})]}),(0,r.jsxs)("nav",{className:"flex flex-col space-y-4 text-gray-300 text-sm",children:[(0,r.jsx)("button",{onClick:()=>c.push("/apps"),className:"text-left hover:text-brand",children:"Apps"}),(0,r.jsx)("button",{onClick:()=>c.push("/vms"),className:"text-left hover:text-brand",children:"Vms"}),(0,r.jsx)("button",{onClick:()=>c.push("/secrets"),className:"text-left hover:text-brand",children:"Secrets"}),(0,r.jsx)("button",{onClick:()=>c.push("/billing"),className:"text-left hover:text-brand",children:"Billing"}),(0,r.jsx)("div",{className:"mt-auto"})]})]})]})}},1059:(e,t,a)=>{"use strict";a.d(t,{NE:()=>o,QQ:()=>d,Y_:()=>l,mU:()=>c,ot:()=>i,sl:()=>n,v$:()=>s});var r=a(6459);async function s(e){let t=await fetch("".concat(r.H,"/").concat(e),{method:"GET",credentials:"include",headers:{"Content-Type":"application/json"}});if(!t.ok){let e=await t.text();throw Error("API Error: ".concat(t.status," ").concat(e))}return t.json()}async function o(e,t){let a={method:"POST",credentials:"include",headers:{"Content-Type":"application/json"}};void 0!==t&&(a.body=JSON.stringify(t));let s=await fetch("".concat(r.H,"/").concat(e),a);if(!s.ok){let e=await s.text();throw Error("API Error: ".concat(s.status," ").concat(e))}return s.json()}async function i(e,t){let a={method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"}};void 0!==t&&(a.body=JSON.stringify(t));let s=await fetch("".concat(r.H,"/").concat(e),a);if(!s.ok){let e=await s.text();throw Error("API Error: ".concat(s.status," ").concat(e))}return s.json()}async function n(e,t){let a={method:"DELETE",credentials:"include",headers:{"Content-Type":"application/json"}};void 0!==t&&(a.body=JSON.stringify(t));let s=await fetch("".concat(r.H,"/").concat(e),a);if(!s.ok){let e=await s.text();throw Error("API Error: ".concat(s.status," ").concat(e))}return s.json()}async function l(e){var t;let a=await fetch("".concat(r.H,"/proxy/billing/calculate?instances=").concat(e.instances),{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!a.ok){let e=await a.text();throw Error("API Error: ".concat(a.status," ").concat(e))}let s=await a.json();if(null==(t=s.errors)?void 0:t.length)throw Error(s.errors.map(e=>e.message).join("; "));return s.data}async function c(e,t){let a=await s("proxy/vms/".concat(e,"/").concat(t));if("ok"!==a.status)throw Error(a.errors.join(", "))}async function d(){let e=await s("proxy/vms");if("ok"!==e.status||!e.data)throw Error(e.errors.join(", "));return e.data}},1713:(e,t,a)=>{"use strict";a.d(t,{A:()=>u});var r=a(4232);let s=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),o=e=>e.replace(/^([A-Z])|[\s-_]+(\w)/g,(e,t,a)=>a?a.toUpperCase():t.toLowerCase()),i=e=>{let t=o(e);return t.charAt(0).toUpperCase()+t.slice(1)},n=function(){for(var e=arguments.length,t=Array(e),a=0;a<e;a++)t[a]=arguments[a];return t.filter((e,t,a)=>!!e&&""!==e.trim()&&a.indexOf(e)===t).join(" ").trim()},l=e=>{for(let t in e)if(t.startsWith("aria-")||"role"===t||"title"===t)return!0};var c={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};let d=(0,r.forwardRef)((e,t)=>{let{color:a="currentColor",size:s=24,strokeWidth:o=2,absoluteStrokeWidth:i,className:d="",children:u,iconNode:p,...m}=e;return(0,r.createElement)("svg",{ref:t,...c,width:s,height:s,stroke:a,strokeWidth:i?24*Number(o)/Number(s):o,className:n("lucide",d),...!u&&!l(m)&&{"aria-hidden":"true"},...m},[...p.map(e=>{let[t,a]=e;return(0,r.createElement)(t,a)}),...Array.isArray(u)?u:[u]])}),u=(e,t)=>{let a=(0,r.forwardRef)((a,o)=>{let{className:l,...c}=a;return(0,r.createElement)(d,{ref:o,iconNode:t,className:n("lucide-".concat(s(i(e))),"lucide-".concat(e),l),...c})});return a.displayName=i(e),a}},1799:(e,t,a)=>{"use strict";a.d(t,{u:()=>n,v:()=>i});var r=a(9099),s=a.n(r),o=a(6459);async function i(){await fetch("".concat(o.H,"/auth/logout"),{method:"POST",credentials:"include"}),s().push("/")}async function n(){await fetch("".concat(o.H,"/auth/logout_all"),{method:"POST",credentials:"include"}),s().push("/")}},2164:(e,t,a)=>{"use strict";a.d(t,{J:()=>o});var r=a(4232),s=a(6459);function o(){let[e,t]=(0,r.useState)(""),[a,o]=(0,r.useState)(""),[i,n]=(0,r.useState)(!0),[l,c]=(0,r.useState)(null);return(0,r.useEffect)(()=>{let e=!0;return async function(){try{let a=await fetch("".concat(s.H,"/auth/me"),{method:"GET",credentials:"include",headers:{"Content-Type":"application/json"}}),r=await a.json();e&&r&&(t(r.user_id),o(r.email))}catch(t){e&&c(t)}finally{e&&n(!1)}}(),()=>{e=!1}},[]),{username:e,email:a,isLoading:i,error:l}}},3780:(e,t,a)=>{"use strict";a.d(t,{A:()=>s});var r=a(7876);function s(){return(0,r.jsx)("div",{className:"absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-sm bg-white/80 dark:bg-gray-900/60",children:(0,r.jsx)("p",{className:"mt-6 text-gray-700 dark:text-gray-300 text-lg font-medium",children:"Loading data…"})})}a(4232)},6459:(e,t,a)=>{"use strict";a.d(t,{H:()=>r});let r="http://localhost:3800"},7685:(e,t,a)=>{"use strict";a.d(t,{l$:()=>ec,oR:()=>z});var r,s=a(4232);let o={data:""},i=e=>"object"==typeof window?((e?e.querySelector("#_goober"):window._goober)||Object.assign((e||document.head).appendChild(document.createElement("style")),{innerHTML:" ",id:"_goober"})).firstChild:e||o,n=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,l=/\/\*[^]*?\*\/|  +/g,c=/\n+/g,d=(e,t)=>{let a="",r="",s="";for(let o in e){let i=e[o];"@"==o[0]?"i"==o[1]?a=o+" "+i+";":r+="f"==o[1]?d(i,o):o+"{"+d(i,"k"==o[1]?"":t)+"}":"object"==typeof i?r+=d(i,t?t.replace(/([^,])+/g,e=>o.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):o):null!=i&&(o=/^--/.test(o)?o:o.replace(/[A-Z]/g,"-$&").toLowerCase(),s+=d.p?d.p(o,i):o+":"+i+";")}return a+(t&&s?t+"{"+s+"}":s)+r},u={},p=e=>{if("object"==typeof e){let t="";for(let a in e)t+=a+p(e[a]);return t}return e},m=(e,t,a,r,s)=>{let o=p(e),i=u[o]||(u[o]=(e=>{let t=0,a=11;for(;t<e.length;)a=101*a+e.charCodeAt(t++)>>>0;return"go"+a})(o));if(!u[i]){let t=o!==e?e:(e=>{let t,a,r=[{}];for(;t=n.exec(e.replace(l,""));)t[4]?r.shift():t[3]?(a=t[3].replace(c," ").trim(),r.unshift(r[0][a]=r[0][a]||{})):r[0][t[1]]=t[2].replace(c," ").trim();return r[0]})(e);u[i]=d(s?{["@keyframes "+i]:t}:t,a?"":"."+i)}let m=a&&u.g?u.g:null;return a&&(u.g=u[i]),((e,t,a,r)=>{r?t.data=t.data.replace(r,e):-1===t.data.indexOf(e)&&(t.data=a?e+t.data:t.data+e)})(u[i],t,r,m),i},f=(e,t,a)=>e.reduce((e,r,s)=>{let o=t[s];if(o&&o.call){let e=o(a),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;o=t?"."+t:e&&"object"==typeof e?e.props?"":d(e,""):!1===e?"":e}return e+r+(null==o?"":o)},"");function h(e){let t=this||{},a=e.call?e(t.p):e;return m(a.unshift?a.raw?f(a,[].slice.call(arguments,1),t.p):a.reduce((e,a)=>Object.assign(e,a&&a.call?a(t.p):a),{}):a,i(t.target),t.g,t.o,t.k)}h.bind({g:1});let g,y,x,b=h.bind({k:1});function v(e,t){let a=this||{};return function(){let r=arguments;function s(o,i){let n=Object.assign({},o),l=n.className||s.className;a.p=Object.assign({theme:y&&y()},n),a.o=/ *go\d+/.test(l),n.className=h.apply(a,r)+(l?" "+l:""),t&&(n.ref=i);let c=e;return e[0]&&(c=n.as||e,delete n.as),x&&c[0]&&x(n),g(c,n)}return t?t(s):s}}var w=e=>"function"==typeof e,j=(e,t)=>w(e)?e(t):e,k=(()=>{let e=0;return()=>(++e).toString()})(),E=(()=>{let e;return()=>{if(void 0===e&&"u">typeof window){let t=matchMedia("(prefers-reduced-motion: reduce)");e=!t||t.matches}return e}})(),N=(e,t)=>{switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,20)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:a}=t;return N(e,{type:+!!e.toasts.find(e=>e.id===a.id),toast:a});case 3:let{toastId:r}=t;return{...e,toasts:e.toasts.map(e=>e.id===r||void 0===r?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let s=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+s}))}}},C=[],A={toasts:[],pausedAt:void 0},$=e=>{A=N(A,e),C.forEach(e=>{e(A)})},O={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},S=(e={})=>{let[t,a]=(0,s.useState)(A),r=(0,s.useRef)(A);(0,s.useEffect)(()=>(r.current!==A&&a(A),C.push(a),()=>{let e=C.indexOf(a);e>-1&&C.splice(e,1)}),[]);let o=t.toasts.map(t=>{var a,r,s;return{...e,...e[t.type],...t,removeDelay:t.removeDelay||(null==(a=e[t.type])?void 0:a.removeDelay)||(null==e?void 0:e.removeDelay),duration:t.duration||(null==(r=e[t.type])?void 0:r.duration)||(null==e?void 0:e.duration)||O[t.type],style:{...e.style,...null==(s=e[t.type])?void 0:s.style,...t.style}}});return{...t,toasts:o}},T=(e,t="blank",a)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...a,id:(null==a?void 0:a.id)||k()}),P=e=>(t,a)=>{let r=T(t,e,a);return $({type:2,toast:r}),r.id},z=(e,t)=>P("blank")(e,t);z.error=P("error"),z.success=P("success"),z.loading=P("loading"),z.custom=P("custom"),z.dismiss=e=>{$({type:3,toastId:e})},z.remove=e=>$({type:4,toastId:e}),z.promise=(e,t,a)=>{let r=z.loading(t.loading,{...a,...null==a?void 0:a.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let s=t.success?j(t.success,e):void 0;return s?z.success(s,{id:r,...a,...null==a?void 0:a.success}):z.dismiss(r),e}).catch(e=>{let s=t.error?j(t.error,e):void 0;s?z.error(s,{id:r,...a,...null==a?void 0:a.error}):z.dismiss(r)}),e};var D=(e,t)=>{$({type:1,toast:{id:e,height:t}})},H=()=>{$({type:5,time:Date.now()})},I=new Map,_=1e3,L=(e,t=_)=>{if(I.has(e))return;let a=setTimeout(()=>{I.delete(e),$({type:4,toastId:e})},t);I.set(e,a)},M=e=>{let{toasts:t,pausedAt:a}=S(e);(0,s.useEffect)(()=>{if(a)return;let e=Date.now(),r=t.map(t=>{if(t.duration===1/0)return;let a=(t.duration||0)+t.pauseDuration-(e-t.createdAt);if(a<0){t.visible&&z.dismiss(t.id);return}return setTimeout(()=>z.dismiss(t.id),a)});return()=>{r.forEach(e=>e&&clearTimeout(e))}},[t,a]);let r=(0,s.useCallback)(()=>{a&&$({type:6,time:Date.now()})},[a]),o=(0,s.useCallback)((e,a)=>{let{reverseOrder:r=!1,gutter:s=8,defaultPosition:o}=a||{},i=t.filter(t=>(t.position||o)===(e.position||o)&&t.height),n=i.findIndex(t=>t.id===e.id),l=i.filter((e,t)=>t<n&&e.visible).length;return i.filter(e=>e.visible).slice(...r?[l+1]:[0,l]).reduce((e,t)=>e+(t.height||0)+s,0)},[t]);return(0,s.useEffect)(()=>{t.forEach(e=>{if(e.dismissed)L(e.id,e.removeDelay);else{let t=I.get(e.id);t&&(clearTimeout(t),I.delete(e.id))}})},[t]),{toasts:t,handlers:{updateHeight:D,startPause:H,endPause:r,calculateOffset:o}}},R=b`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,U=b`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,F=b`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,J=v("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${R} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${U} 0.15s ease-out forwards;
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
    animation: ${F} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,B=b`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,W=v("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${B} 1s linear infinite;
`,Z=b`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,G=b`
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
}`,Q=v("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${Z} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${G} 0.2s ease-out forwards;
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
`,Y=v("div")`
  position: absolute;
`,q=v("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,V=b`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,K=v("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${V} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,X=({toast:e})=>{let{icon:t,type:a,iconTheme:r}=e;return void 0!==t?"string"==typeof t?s.createElement(K,null,t):t:"blank"===a?null:s.createElement(q,null,s.createElement(W,{...r}),"loading"!==a&&s.createElement(Y,null,"error"===a?s.createElement(J,{...r}):s.createElement(Q,{...r})))},ee=e=>`
0% {transform: translate3d(0,${-200*e}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,et=e=>`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*e}%,-1px) scale(.6); opacity:0;}
`,ea=v("div")`
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
`,er=v("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,es=(e,t)=>{let a=e.includes("top")?1:-1,[r,s]=E()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[ee(a),et(a)];return{animation:t?`${b(r)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${b(s)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}},eo=s.memo(({toast:e,position:t,style:a,children:r})=>{let o=e.height?es(e.position||t||"top-center",e.visible):{opacity:0},i=s.createElement(X,{toast:e}),n=s.createElement(er,{...e.ariaProps},j(e.message,e));return s.createElement(ea,{className:e.className,style:{...o,...a,...e.style}},"function"==typeof r?r({icon:i,message:n}):s.createElement(s.Fragment,null,i,n))});r=s.createElement,d.p=void 0,g=r,y=void 0,x=void 0;var ei=({id:e,className:t,style:a,onHeightUpdate:r,children:o})=>{let i=s.useCallback(t=>{if(t){let a=()=>{r(e,t.getBoundingClientRect().height)};a(),new MutationObserver(a).observe(t,{subtree:!0,childList:!0,characterData:!0})}},[e,r]);return s.createElement("div",{ref:i,className:t,style:a},o)},en=(e,t)=>{let a=e.includes("top"),r=e.includes("center")?{justifyContent:"center"}:e.includes("right")?{justifyContent:"flex-end"}:{};return{left:0,right:0,display:"flex",position:"absolute",transition:E()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${t*(a?1:-1)}px)`,...a?{top:0}:{bottom:0},...r}},el=h`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,ec=({reverseOrder:e,position:t="top-center",toastOptions:a,gutter:r,children:o,containerStyle:i,containerClassName:n})=>{let{toasts:l,handlers:c}=M(a);return s.createElement("div",{id:"_rht_toaster",style:{position:"fixed",zIndex:9999,top:16,left:16,right:16,bottom:16,pointerEvents:"none",...i},className:n,onMouseEnter:c.startPause,onMouseLeave:c.endPause},l.map(a=>{let i=a.position||t,n=en(i,c.calculateOffset(a,{reverseOrder:e,gutter:r,defaultPosition:t}));return s.createElement(ei,{id:a.id,key:a.id,onHeightUpdate:c.updateHeight,className:a.visible?el:"",style:n},"custom"===a.type?j(a.message,a):o?o(a):s.createElement(eo,{toast:a,position:i}))}))}},8447:(e,t,a)=>{"use strict";a.d(t,{A:()=>r});let r=(0,a(1713).A)("menu",[["path",{d:"M4 12h16",key:"1lakjw"}],["path",{d:"M4 18h16",key:"19g7jn"}],["path",{d:"M4 6h16",key:"1o0s65"}]])},9099:(e,t,a)=>{e.exports=a(8253)}}]);