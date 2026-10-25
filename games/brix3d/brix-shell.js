    // The sidebar is fetched after first paint and parsed a few nodes at a time.
    // The initial document stays small so HTML parse is not a 50ms+ task.
    // Park it in a hidden holder (no layout), start the module, then thaw
    // one section per turn so no layout task stays on the main thread.
    (function () {
      // Parser only. The mount half is a second script so compile stays short.
      function nextTop(text, pos) {
        var n = text.length;
        while (pos < n) {
          var c = text.charCodeAt(pos);
          if (c === 32 || c === 10 || c === 13 || c === 9) { pos++; continue; }
          break;
        }
        if (pos >= n) return null;
        if (text.charCodeAt(pos) !== 60) {
          var lt = text.indexOf('<', pos);
          return { start: pos, end: lt < 0 ? n : lt };
        }
        if (text.slice(pos, pos + 4) === '<!--') {
          var ce = text.indexOf('-->', pos);
          return { start: pos, end: ce < 0 ? n : ce + 3 };
        }
        var i = pos + 1;
        if (text.charCodeAt(i) === 47) return { start: pos, end: Math.min(n, pos + 1) };
        var nameEnd = i;
        while (nameEnd < n) {
          var cc = text.charCodeAt(nameEnd);
          var ok = (cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122) || (cc >= 48 && cc <= 57);
          if (!ok) break;
          nameEnd++;
        }
        var name = text.slice(i, nameEnd).toLowerCase();
        var q = '';
        var j = nameEnd;
        while (j < n) {
          var ch = text.charAt(j);
          if (q) { if (ch === q) q = ''; j++; continue; }
          if (ch === '"' || ch === "'") { q = ch; j++; continue; }
          if (ch === '>') break;
          j++;
        }
        var voids = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, source: 1, track: 1, wbr: 1 };
        if ((j > pos && text.charAt(j - 1) === '/') || voids[name] || j >= n) {
          return { start: pos, end: Math.min(n, j + 1), name: name };
        }
        var close = '</' + name;
        var depth = 1;
        var k = j + 1;
        while (k < n && depth > 0) {
          var lt2 = text.indexOf('<', k);
          if (lt2 < 0) break;
          var head = text.slice(lt2, lt2 + close.length).toLowerCase();
          if (head === close) {
            depth--;
            if (depth === 0) {
              var gt = text.indexOf('>', lt2);
              return { start: pos, end: gt < 0 ? n : gt + 1, name: name, openEnd: j };
            }
            k = lt2 + close.length;
          } else if (text.charAt(lt2 + 1) !== '/' && text.charAt(lt2 + 1) !== '!') {
            var n2 = lt2 + 1;
            while (n2 < n) {
              var c2 = text.charCodeAt(n2);
              var ok2 = (c2 >= 65 && c2 <= 90) || (c2 >= 97 && c2 <= 122) || (c2 >= 48 && c2 <= 57);
              if (!ok2) break;
              n2++;
            }
            if (text.slice(lt2 + 1, n2).toLowerCase() === name) depth++;
            k = n2;
          } else k = lt2 + 2;
        }
        return { start: pos, end: n, name: name, openEnd: j };
      }
      function appendHtml(parent, html) {
        var tpl = document.createElement('template');
        tpl.innerHTML = html;
        while (tpl.content.firstChild) parent.appendChild(tpl.content.firstChild);
      }
      function parseLate(text, hold, done) {
        var jobs = [{ text: text, pos: 0, parent: hold }];
        function step() {
          var t0 = performance.now();
          var job = jobs[jobs.length - 1];
          var batch = '';
          var parent = job ? job.parent : null;
          while (job && performance.now() - t0 < 8) {
            var part = nextTop(job.text, job.pos);
            if (!part || part.end <= job.pos) {
              if (batch && parent) { appendHtml(parent, batch); batch = ''; }
              jobs.pop();
              job = jobs[jobs.length - 1];
              parent = job ? job.parent : null;
              continue;
            }
            var len = part.end - part.start;
            if (len > 7000 && part.openEnd && part.name) {
              if (batch && parent) { appendHtml(parent, batch); batch = ''; }
              var shell = job.text.slice(part.start, part.openEnd + 1) + '</' + part.name + '>';
              var shellTpl = document.createElement('template');
              shellTpl.innerHTML = shell;
              var el = shellTpl.content.firstElementChild;
              if (el && parent) parent.appendChild(el);
              var innerEnd = part.end - (part.name.length + 3);
              var inner = job.text.slice(part.openEnd + 1, innerEnd);
              job.pos = part.end;
              if (el && inner.trim()) jobs.push({ text: inner, pos: 0, parent: el });
              break;
            }
            if (batch && batch.length + len > 7000) break;
            batch += job.text.slice(part.start, part.end);
            job.pos = part.end;
            if (batch.length >= 6000) break;
          }
          if (batch && parent) appendHtml(parent, batch);
          if (jobs.length) setTimeout(step, 0);
          else done();
        }
        setTimeout(step, 0);
      }
      window.__brixParseLate = parseLate;
    })();
