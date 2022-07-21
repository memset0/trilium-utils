/**
 * Frontend formatter for Javascript and CSS codes
 * formatter.js 
 * (c) memset0 2020
 * 
 * Configuration:
 *   * token: Your ETAPI token, get it from `Options > ETAPI > Create new ETAPI token`
 * 
 * Default Shortcuts:
 *   * 'alt+shift+f': Format
 */

const token = '{{ token }}';
const shortcuts = {
	format: 'alt+shift+f',
};

(async function () {
	class ETAPI {
		cleanParams(targetObject) {
			for (const key in targetObject) {
				if (targetObject[key] === undefined || targetObject[key] === null) {
					delete targetObject[key];
				}
			}
			return targetObject;
		}

		async login() {
			const res = await $.post(this.server + 'etapi/auth/login', {
				password: this.password
			});
			this.authToken = res.authToken;
		}

		async fetch(method, url, data, headers) {
			const res = await $.ajax({
				type: method,
				url: this.server + 'etapi/' + (url.startsWith('/') ? url.slice(1) : url),
				data: data,
				headers: {
					'Authorization': this.authToken,
					...headers
				}
			});
			return res;
		}

		getNote(noteId) {
			return this.fetch('get', `/notes/${noteId}`);
		}

		patchNote(noteId, title = null, type = null, mime = null) {
			const params = this.cleanParams({
				title,
				type,
				mime
			});
			return this.fetch('patch', `/notes/${noteId}`, params);
		}

		getNoteContent(noteId) {
			return this.fetch('get', `/notes/${noteId}/content`);
		}

		putNoteContent(noteId, content, contentType = 'text/plain') {
			return this.fetch('put', `/notes/${noteId}/content`, content, {
				'content-type': contentType
			});
		}

		constructor(authKey, authType = 'token', options = {}) {
			this.authKey = authKey;
			this.authType = authType;
			this.name = options.name || null;
			this.server = options.server ?
				(options.server.endsWith('/') ? options.server : options.server.slice(0, -1)) :
				'/';

			if (authType === 'token') {
				this.authToken = authKey;
			} else if (authType === 'password') {
				this.password = authKey;
				this.login(this.password);
			}
		}
	}

	const et = new ETAPI(token);

	if (!global.formatter) global.formatter = {};
	if (!global.formatter.libs) global.formatter.libs = [];

	async function includeLib(name, remoteUrl) {
		if (global.formatter.libs.includes(name)) {
			return;
		}

		let codeToEval = localStorage.getItem(`$formatter.cache.${name}`);
		if (!codeToEval) {
			codeToEval = await $.get(remoteUrl);
			localStorage.setItem(`$formatter.cache.${name}`, codeToEval);
		}

		(1, eval)(codeToEval); // see https://stackoverflow.com/questions/9107240/1-evalthis-vs-evalthis-in-javascript
		global.formatter.libs.push(name);
	}

	async function renderNoteMarkdown(note) {
		const {
			noteId
		} = note;

		const contentPlain = await et.getNoteContent(noteId);
		const content = (contentPlain + '$').split(/(?<=\<\/(p|h2|h3|h4|h5|h6|ol|ul|li|figure)\>)/g).filter((_, index) => (index % 2 == 0)).slice(0, -1);

		if (content.join('') != contentPlain) {
			console.log({
				content,
				contentPlain
			});
			api.showError(`Can't format actived note (${noteId})`);
			return;
		}

		for (const index in content) {
			let line = content[index];

			// headers
			if (line.match(/^\<p\>#{2,} /)) {
				const level = line.match(/^\<p\>(#{2,}) /)[1].length;
				line = `<h${level}>` + line.slice(3 /* length of <p> */ + level + 1, -4 /* length of </p> */) + `</h${level}>`;
			}
			// math;
			line = line.replace(/\$\$(.+?)\$\$/g, (_, tex) => ('<span class="math-tex">\\(\\displaystyle ' + tex + '\\)</span>'));
			line = line.replace(/\\\\\[(.+?)\\\\\]/g, (_, tex) => ('<span class="math-tex">\\(\\displaystyle ' + tex + '\\)</span>'));
			console.log(line.match(/\$(.+?)\$/g));
			line = line.replace(/\$(.+?)\$/g, (_, tex) => ('<span class="math-tex">\\(' + tex + '\\)</span>'));
			// sub & sup
			// line = line.replace(/\~(.+?)\~/g, (_, html) => ('<sub>' + html + '</sub>'));
			// line = line.replace(/\^(.+?)\^/g, (_, html) => ('<sup>' + html + '</sup>'));

			content[index] = line;
		}

		console.log(noteId, content);
		await et.putNoteContent(noteId, content.join(''));
	}

	async function formatJavascriptCode(note) {
		await includeLib('jsBeautify', 'https://cdnjs.cloudflare.com/ajax/libs/js-beautify/1.14.0/beautify.min.js');

		const {
			noteId
		} = note;

		const sourceCode = await et.getNoteContent(noteId);
		const targetCode = global.js_beautify(sourceCode, {
			space_after_anon_function: true,
		});

		await et.putNoteContent(noteId, targetCode);
	}

	async function formatCssCode(note) {
		await includeLib('cssBeautify', 'https://cdnjs.cloudflare.com/ajax/libs/js-beautify/1.14.0/beautify-css.min.js');

		const {
			noteId
		} = note;

		const sourceCode = await et.getNoteContent(noteId);
		const targetCode = global.css_beautify(sourceCode);

		await et.putNoteContent(noteId, targetCode);
	}


	api.addButtonToToolbar({
		title: 'Formatter',
		icon: 'bx bxs-magic-wand',
		shortcut: shortcuts.format,
		action: async () => {
			const note = api.getActiveTabNote();
			const {
				type,
				mime
			} = note;

			await api.waitUntilSynced();
			if (type === 'text' && mime === 'text/html') {
				// renderNoteMarkdown(note);
				// not completely developed
			} else if (type === 'code' && mime === 'application/javascript;env=frontend') {
				formatJavascriptCode(note);
			} else if (type === 'code' && mime === 'application/javascript;env=backend') {
				formatJavascriptCode(note);
			} else if (type === 'code' && mime === 'text/css') {
				formatCssCode(note);
			}
		}
	});
})();