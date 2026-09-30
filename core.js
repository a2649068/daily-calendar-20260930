(function(root){
  'use strict';
  const pad=n=>String(n).padStart(2,'0');
  function key(y,m,d){return `${y}-${pad(m)}-${pad(d)}`;}
  function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const [y,m,d]=value.split('-').map(Number);const x=new Date(Date.UTC(y,m-1,d));return y>=1900&&y<=2200&&x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d;}
  function taipeiNow(now=new Date()){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};}
  function addDays(value,n){const [y,m,d]=value.split('-').map(Number);const x=new Date(Date.UTC(y,m-1,d+n));return key(x.getUTCFullYear(),x.getUTCMonth()+1,x.getUTCDate());}
  function cnNumber(s){if(/^\d+$/.test(s))return Number(s);const nums={'零':0,'〇':0,'一':1,'二':2,'兩':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};if(s.includes('十')){const [a,b]=s.split('十');return (a?nums[a]:1)*10+(b?nums[b]:0);}return Object.hasOwn(nums,s)?nums[s]:NaN;}
  function normalize(s){return s.normalize('NFKC').replace(/[零〇一二兩三四五六七八九十]+(?=月|日|號)/g,cnNumber).replace(/民國\s*(\d{2,3})\s*年/g,(_,y)=>`${Number(y)+1911}年`);}
  function findDates(text,year,base){const matches=[];
    const explicit=/(?<!\d)(?:(\d{4}|\d{3})\s*(?:年|[\/.-])\s*)?(\d{1,2})\s*(?:月|[\/.-])\s*(\d{1,2})\s*(?:日|號)?(?!\d)/g;
    for(const m of text.matchAll(explicit)){let y=m[1]?Number(m[1]):year;if(y<1911&&m[1]?.length===3)y+=1911;const date=key(y,Number(m[2]),Number(m[3]));matches.push({index:m.index,end:m.index+m[0].length,date:validDate(date)?date:'',warning:validDate(date)?'':`日期「${m[0]}」不存在，請修改`,raw:m[0]});}
    const rel=/(大後天|大前天|今天|今日|明天|明日|後天|昨天|昨日|前天|下(?:週|周|星期)[一二三四五六日天]|(?:本|這)(?:週|周|星期)[一二三四五六日天])/g;
    const offsets={大後天:3,大前天:-3,今天:0,今日:0,明天:1,明日:1,後天:2,昨天:-1,昨日:-1,前天:-2};
    for(const m of text.matchAll(rel)){let date;if(Object.hasOwn(offsets,m[0]))date=addDays(base,offsets[m[0]]);else{const weekday={'日':0,'天':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6}[m[0].slice(-1)];const current=new Date(base+'T00:00:00Z').getUTCDay();const monday=addDays(base,-((current+6)%7));date=addDays(monday,(m[0].startsWith('下')?7:0)+(weekday+6)%7);}matches.push({index:m.index,end:m.index+m[0].length,date,raw:m[0]});}
    return matches.sort((a,b)=>a.index-b.index);
  }
  function extractTime(text){const m=normalize(text).match(/(?:(上午|早上|中午|下午|晚上|晚間|凌晨)\s*)?(\d{1,2}|[一二兩三四五六七八九十]+)\s*(?::\s*(\d{2})|(?:點|時)(?:(半)|(\d{1,2})\s*分?)?)/);if(!m)return '';let h=cnNumber(m[2]),min=m[4]?30:Number(m[3]||m[5]||0);if(['下午','晚上','晚間'].includes(m[1])&&h<12)h+=12;if(m[1]==='中午'&&h<11)h+=12;if(['凌晨','上午','早上'].includes(m[1])&&h===12)h=0;return h>=0&&h<24&&min>=0&&min<60?`${pad(h)}:${pad(min)}`:'';}
  function parseText(source,options={}){const base=options.baseDate||taipeiNow().date,year=Number(options.year)||Number(base.slice(0,4));let context=null;const result=[];
    for(const original of source.split(/\r?\n/)){const line=normalize(original).trim();if(!line)continue;const found=findDates(line,year,base);if(!found.length){result.push({date:context||'',time:extractTime(line),text:original.trim(),warning:context?'依上一行日期':'未辨識到日期，請指定'});continue;}
      const range=/(?:至|到|[~～–—-])\s*(?:\d|下週|明天)/.test(line)&&found.length>1;
      const onlyDates=line.replace(/（[^）]*）|\([^)]*\)/g,'').replace(/[,，、:：\s]/g,'')===found.map(x=>x.raw.replace(/\s/g,'')).join('');
      if(onlyDates&&found.length===1&&found[0].date){context=found[0].date;continue;}context=null;
      for(let i=0;i<found.length;i++){const f=found[i];let text=line.slice(f.end,found[i+1]?.index||line.length).replace(/^[\s,，、:：;；]+|[\s,，、;；]+$/g,'');const prefix=line.slice(0,found[0].index).trim();if(i===0&&prefix)text=prefix+' '+text;if(!text)text=line;result.push({date:f.date,time:extractTime(text),text,warning:f.warning||(range?'偵測到日期範圍；目前只列出明確日期，請拆成所需日期。':found.length>1?'同一行有多個日期，請確認文字對應。':'')});}
    }
    if(!result.length&&context)result.push({date:context,time:'',text:source.trim(),warning:'只有日期，請補上事項'});
    return result;
  }
  function validEvent(e){return e&&typeof e.id==='string'&&e.id.length>0&&e.id.length<200&&validDate(e.date)&&typeof e.text==='string'&&e.text.trim().length>0&&e.text.length<=20000&&typeof e.done==='boolean'&&typeof e.time==='string'&&(!e.time||/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time));}
  function icsEscape(s){return String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
  function fold(line){let lines=[],part='',bytes=0;for(const c of line){const size=new TextEncoder().encode(c).length;if(bytes+size>75){lines.push(part);part=' ';bytes=1;}part+=c;bytes+=size;}lines.push(part);return lines.join('\r\n');}
  function utcTime(date,time){const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number);return new Date(Date.UTC(y,m-1,d,h-8,min)).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');}
  function buildICS(events,{start=taipeiNow().date,days=90,now=new Date()}={}){const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Daily Calendar//ZH-TW','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:日日記','X-WR-TIMEZONE:Asia/Taipei'];const stamp=now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');for(let offset=0;offset<days;offset++){const date=addDays(start,offset);const items=events.filter(x=>x.date===date&&!x.done).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));const body=items.length?items.map((x,i)=>`${i+1}. ${x.time?x.time+' ':''}${x.text}`).join('\n'):'今天沒有待辦事項。';for(const time of ['08:30','13:30']){lines.push('BEGIN:VEVENT',`UID:daily-${date}-${time.replace(':','')}@daily-calendar.local`,`DTSTAMP:${stamp}`,`LAST-MODIFIED:${stamp}`,`DTSTART:${utcTime(date,time)}`,`DTEND:${utcTime(date,time.slice(0,3)+'35')}`,`SUMMARY:${icsEscape(`日日記｜今日 ${items.length} 件待辦`)}`,`DESCRIPTION:${icsEscape(`${date} 今日注意事項\n${body}\n\n此為匯出當時的快照，後續修改請重新匯入。`)}`,'TRANSP:TRANSPARENT','BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:PT0S',`DESCRIPTION:${icsEscape(body)}`,'END:VALARM','END:VEVENT');}}lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';}
  const api={validDate,taipeiNow,addDays,parseText,extractTime,validEvent,buildICS,key};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CalendarCore=api;
})(typeof window!=='undefined'?window:globalThis);
