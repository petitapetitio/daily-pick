import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile } from 'obsidian';

interface DailyPickSettings {
	sourceFilePath: string;
    currentIndex: number;
}

const DEFAULT_SETTINGS: DailyPickSettings = {
	sourceFilePath: 'lists/daily-items.md',
    currentIndex: 0
}

export default class DailyPick extends Plugin {
	settings: DailyPickSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new DailyPickSettingTab(this.app, this));

		this.registerEvent(
            this.app.vault.on('create', (file: TAbstractFile) => this.onFileCreated(file))
        );

	}

	async onFileCreated(file: TAbstractFile) {
        if (!(file instanceof TFile)) return;

        const isDailyNote = /^\d{4}-\d{2}-\d{2}\.md$/.test(file.name);
        if (!isDailyNote) return;

        try {
            const sourceFile = this.app.vault.getAbstractFileByPath(this.settings.sourceFilePath);
            if (!(sourceFile instanceof TFile)) {
                console.error('Source file not found:', this.settings.sourceFilePath);
                return;
            }

            const sourceContent = await this.app.vault.read(sourceFile);
            const items = this.parseItems(sourceContent);
            if (items.length === 0) return;

            const currentContent = await this.app.vault.read(file);
            const item = items[this.settings.currentIndex % items.length]
            const newContent = `${item}\n\n${currentContent}`;
            await this.app.vault.modify(file, newContent);

            this.settings.currentIndex += 1;
			await this.saveSettings();

        } catch (error) {
            console.error('Error injecting items into daily note:', error);
        }
    }

    parseItems(content: string): string[] {
        // Split content into lines and filter out empty lines
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            // Remove existing list markers if present
            .map(line => line.replace(/^[-*+]\s*(\[ \])?/, '').trim());
    }

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class DailyPickSettingTab extends PluginSettingTab {
	plugin: DailyPick;

	constructor(app: App, plugin: DailyPick) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h2', {text: 'Daily Pick Settings'});

		new Setting(containerEl)
            .setName('Source File Path')
            .setDesc('Path to the file containing items to inject (relative to vault root)')
            .addText(text => text
                .setPlaceholder('lists/daily-items.md')
                .setValue(this.plugin.settings.sourceFilePath)
                .onChange(async (value) => {
                    this.plugin.settings.sourceFilePath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Reset cycle')
            .setDesc('Reset to the first item in the list')
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.currentIndex = 0;
                    await this.plugin.saveSettings();
                }));

        const currentPosition = containerEl.createEl('div', {
            text: `Current position: ${this.plugin.settings.currentIndex}`
        });
	}
}
