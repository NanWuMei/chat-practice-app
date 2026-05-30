import { describe, expect, it } from 'vitest';
import {
  parseChatModelResult, parseHintResult, parseM2Output,
} from '../../src/shared/validators';

describe('AI 输出验证器 v3.0', () => {
  describe('聊天模型输出', () => {
    it('解析合法的聊天回复', () => {
      const result = parseChatModelResult({ reply: '刚下班，有点累，不过还行。' });
      expect(result.reply).toContain('刚下班');
    });

    it('拒绝空回复', () => {
      expect(() => parseChatModelResult({ reply: '' })).toThrow();
    });

    it('拒绝缺少reply', () => {
      expect(() => parseChatModelResult({})).toThrow();
    });
  });

  describe('M2 苏格拉底提问', () => {
    it('解析合法的M2输出', () => {
      const result = parseM2Output({
        questions: [
          { km_id: 1, question: '你当时在想什么？' },
          { km_id: 2, question: '你注意到自己问了多少问题吗？' },
        ],
      });
      expect(result.questions).toHaveLength(2);
      expect(result.questions[0].question).toContain('想');
    });

    it('拒绝空questions', () => {
      expect(() => parseM2Output({ questions: [] })).toThrow();
    });

    it('拒绝缺少question', () => {
      expect(() => parseM2Output({ questions: [{ km_id: 1 }] })).toThrow();
    });

    it('拒绝km_id小于1', () => {
      expect(() => parseM2Output({ questions: [{ km_id: 0, question: 'test' }] })).toThrow();
    });
  });

  describe('提示输出', () => {
    it('解析合法提示', () => {
      const result = parseHintResult({ hints: ['先接住疲惫。', '分享自己。'] });
      expect(result.hints).toHaveLength(2);
    });

    it('拒绝空数组', () => {
      expect(() => parseHintResult({ hints: [] })).toThrow();
    });
  });
});
