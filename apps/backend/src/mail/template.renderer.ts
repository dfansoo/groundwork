import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

/** Add a name here, then a `<name>.hbs` + `<name>.text.hbs` pair under ./templates. */
export type TemplateName = 'password-reset' | 'password-changed';

const SUBJECTS: Record<TemplateName, string> = {
  'password-reset': 'Reset your password',
  'password-changed': 'Your password was changed',
};

@Injectable()
export class TemplateRenderer {
  private readonly dir = path.join(__dirname, 'templates');
  private readonly cache = new Map<string, Handlebars.TemplateDelegate>();
  private readonly appName: string;

  constructor(config: ConfigService) {
    this.appName = config.get<string>('MAIL_FROM_NAME') ?? 'Groundwork';
  }

  render(
    name: TemplateName,
    data: Record<string, unknown>,
  ): { subject: string; html: string; text: string } {
    // `appName` is available to every template, so branding lives in config
    // rather than being baked into the markup.
    const vars = { ...data, appName: this.appName };
    const bodyHtml = this.compile(`${name}.hbs`, false)(vars);
    const layout = this.compile('layout.hbs', false);
    return {
      subject: `${SUBJECTS[name]} — ${this.appName}`,
      html: layout({ body: new Handlebars.SafeString(bodyHtml), appName: this.appName }),
      // Plaintext parts must not be HTML-escaped (Handlebars escapes `{{ }}` by
      // default regardless of extension, which would mangle URLs like `?token=`).
      text: this.compile(`${name}.text.hbs`, true)(vars),
    };
  }

  private compile(file: string, noEscape: boolean): Handlebars.TemplateDelegate {
    const cached = this.cache.get(file);
    if (cached) return cached;
    const source = fs.readFileSync(path.join(this.dir, file), 'utf8');
    const tpl = Handlebars.compile(source, { noEscape });
    this.cache.set(file, tpl);
    return tpl;
  }
}
