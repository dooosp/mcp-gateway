import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readdirSync } from 'fs';
import { join } from 'path';

const exec = promisify(execFile);
const BUILDER_PATH = process.env.REPORT_BUILDER_PATH
  || '/home/taeho/report-builder';
const VALIDATOR_PATH = process.env.REPORT_VALIDATOR_PATH
  || '/home/taeho/report-validator';
const PYTHON = process.env.REPORT_BUILDER_PYTHON || 'python3';

const txt = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
const err = (msg) => ({ content: [{ type: 'text', text: msg }], isError: true });

export function register(server) {

  server.registerTool('report_generate', {
    description: 'Excel 보고서 자동 생성 (원본 .xlsx + YAML 설정 → 보고서 .xlsx)',
    inputSchema: {
      inputFile: z.string().describe('원본 Excel 파일 절대경로'),
      configFile: z.string().describe('YAML 설정 파일 절대경로'),
      outputFile: z.string().optional().describe('출력 파일 경로 (생략 시 자동)')
    }
  }, async ({ inputFile, configFile, outputFile }) => {
    try {
      // 경로 검증: 절대경로 + 허용 확장자
      if (!inputFile.startsWith('/')) return err('inputFile은 절대경로 필수');
      if (!configFile.startsWith('/')) return err('configFile은 절대경로 필수');
      if (!inputFile.endsWith('.xlsx') && !inputFile.endsWith('.xls'))
        return err('inputFile은 .xlsx/.xls만 지원');
      if (!configFile.endsWith('.yaml') && !configFile.endsWith('.yml'))
        return err('configFile은 .yaml/.yml만 지원');

      const args = ['main.py', '--input', inputFile, '--config', configFile, '--json'];
      if (outputFile) args.push('--output', outputFile);

      const { stdout } = await exec(PYTHON, args, {
        cwd: BUILDER_PATH,
        timeout: 60000
      });
      return txt(JSON.parse(stdout));
    } catch (e) {
      return err(e.stderr || e.message);
    }
  });

  server.registerTool('report_validate', {
    description: 'Excel 보고서 5계층 교차검증 (구조/수식/교차계산/무결성/서식)',
    inputSchema: {
      reportFile: z.string().describe('검증할 .xlsx 파일 절대경로'),
      configFile: z.string().describe('YAML 설정 파일 절대경로'),
      sourceFile: z.string().optional().describe('원본 데이터 .xlsx (선택)')
    }
  }, async ({ reportFile, configFile, sourceFile }) => {
    try {
      if (!reportFile.startsWith('/')) return err('reportFile은 절대경로 필수');
      if (!configFile.startsWith('/')) return err('configFile은 절대경로 필수');
      if (!reportFile.endsWith('.xlsx'))
        return err('reportFile은 .xlsx만 지원');
      if (!configFile.endsWith('.yaml') && !configFile.endsWith('.yml'))
        return err('configFile은 .yaml/.yml만 지원');

      const args = ['main.py', '--report', reportFile, '--config', configFile, '--json'];
      if (sourceFile) args.push('--source', sourceFile);

      const { stdout } = await exec(PYTHON, args, {
        cwd: VALIDATOR_PATH,
        timeout: 60000
      });
      return txt(JSON.parse(stdout));
    } catch (e) {
      return err(e.stderr || e.message);
    }
  });

  server.registerTool('report_list_templates', {
    description: '사용 가능한 보고서 YAML 템플릿 목록 조회',
    inputSchema: {}
  }, async () => {
    try {
      const templatesDir = join(BUILDER_PATH, 'templates');
      const files = readdirSync(templatesDir)
        .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
        .map(f => ({
          name: f,
          path: join(templatesDir, f)
        }));
      return txt({ templates: files });
    } catch (e) {
      return err(e.message);
    }
  });
}
