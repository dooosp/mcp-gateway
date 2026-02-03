import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);
const ROBOT_PATH = process.env.ROBOT_MODELER_PATH
  || '/home/taeho/robot-modeler';
const PYTHON = 'python3';
const CLI = `${ROBOT_PATH}/src/cli.py`;

const txt = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
const err = (msg) => ({ content: [{ type: 'text', text: msg }], isError: true });

export function register(server) {

  server.registerTool('robot_design', {
    description: '자연어로 로봇 설계 (Orchestrator + Critic + Stress Tester 파이프라인)',
    inputSchema: {
      prompt: z.string().describe('설계 요구사항 (자연어)')
    }
  }, async ({ prompt }) => {
    try {
      const { stdout, stderr } = await exec(PYTHON, [
        CLI, 'pipeline', prompt, '--scenarios', '20'
      ], {
        cwd: ROBOT_PATH,
        timeout: 180000,
        env: { ...process.env, PYTHONPATH: `${ROBOT_PATH}/src` }
      });
      return txt({ output: stdout, warnings: stderr || null });
    } catch (e) {
      return err(e.stderr || e.message);
    }
  });

  server.registerTool('robot_critic', {
    description: '로봇 설계 물리 비판 분석 (정적 토크/응력/에너지 검증)',
    inputSchema: {
      xmlPath: z.string().describe('MJCF XML 파일 절대경로'),
      jsonPath: z.string().optional().describe('로봇 JSON 파일 (프리셋 미매칭 시)'),
      gemini: z.boolean().optional().default(false).describe('Gemini 추천 사용')
    }
  }, async ({ xmlPath, jsonPath, gemini }) => {
    try {
      if (!xmlPath.startsWith('/')) return err('xmlPath는 절대경로 필수');

      const args = [CLI, 'critic', xmlPath];
      if (jsonPath) args.push('--json', jsonPath);
      if (gemini) args.push('--gemini');

      const { stdout } = await exec(PYTHON, args, {
        cwd: ROBOT_PATH,
        timeout: 60000,
        env: { ...process.env, PYTHONPATH: `${ROBOT_PATH}/src` }
      });
      return txt({ output: stdout });
    } catch (e) {
      return err(e.stderr || e.message);
    }
  });

  server.registerTool('robot_stress_test', {
    description: '로봇 설계 강건성 스트레스 테스트 (도메인 랜덤화/공차 분석)',
    inputSchema: {
      xmlPath: z.string().describe('MJCF XML 파일 절대경로'),
      jsonPath: z.string().optional().describe('로봇 JSON 파일'),
      scenarios: z.number().int().min(5).max(200).optional().default(50)
        .describe('테스트 시나리오 수')
    }
  }, async ({ xmlPath, jsonPath, scenarios }) => {
    try {
      if (!xmlPath.startsWith('/')) return err('xmlPath는 절대경로 필수');

      const args = [CLI, 'stress', xmlPath, '--scenarios', String(scenarios || 50)];
      if (jsonPath) args.push('--json', jsonPath);

      const { stdout } = await exec(PYTHON, args, {
        cwd: ROBOT_PATH,
        timeout: 300000,
        env: { ...process.env, PYTHONPATH: `${ROBOT_PATH}/src` }
      });
      return txt({ output: stdout });
    } catch (e) {
      return err(e.stderr || e.message);
    }
  });
}
