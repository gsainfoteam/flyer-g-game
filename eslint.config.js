import { readdirSync } from 'node:fs'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/*
 * 계층 규칙 (docs 없이도 알 수 있게 여기에 둔다)
 *
 *   app → pages → widgets → features → entities → shared
 *
 * - 각 계층은 자기보다 아래 계층만 import한다. 위를 import하면 의존이 거꾸로
 *   흐르고, 아래 계층을 고칠 때 위 계층이 함께 깨진다.
 * - feature끼리는 서로 import하지 않는다. 둘이 같은 것을 쓰면 entities로 내린다.
 * - shared는 entities의 **타입**만 쓸 수 있다(repository 계약이 도메인 타입을 쓴다).
 * - mocks(개발·데모용 가짜 서버)는 app의 조립 단계와 각 계층의 `api/` 구현만 쓴다.
 *   화면 코드가 mock을 직접 알면 실제 API로 바꿀 때 화면까지 고쳐야 한다.
 * - test, dev는 규칙 밖이다.
 */
const layer = (name) => ({
  regex: `^@/${name}(/|$)`,
  message: `이 계층에서는 @/${name} 계층을 import할 수 없습니다. (eslint.config.js의 계층 규칙)`,
})

const restrict = (...patterns) => ({
  '@typescript-eslint/no-restricted-imports': ['error', { patterns }],
})

const features = readdirSync(new URL('./src/features', import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

const otherFeatures = (name) => ({
  regex: `^@/features/(?!${name}(/|$))`,
  message: 'feature끼리는 import하지 않습니다. 함께 쓰는 것은 entities로 내리세요.',
})

export default defineConfig([
  globalIgnores(['dist', 'src/shared/api/generated']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // shadcn 생성 파일은 컴포넌트와 cva variant를 한 파일에서 함께 내보낸다.
    // 재생성·비교가 가능하도록 생성본 구조를 바꾸지 않고 규칙만 완화한다.
    files: ['src/shared/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // --- 계층 규칙 ------------------------------------------------------------
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: restrict(
      layer('app'),
      layer('pages'),
      layer('widgets'),
      layer('features'),
      layer('mocks'),
      { ...layer('entities'), allowTypeImports: true },
    ),
  },
  {
    files: ['src/entities/**/*.{ts,tsx}'],
    rules: restrict(
      layer('app'),
      layer('pages'),
      layer('widgets'),
      layer('features'),
      layer('mocks'),
    ),
  },
  {
    files: ['src/entities/*/api/**/*.{ts,tsx}'],
    rules: restrict(layer('app'), layer('pages'), layer('widgets'), layer('features')),
  },
  ...features.flatMap((name) => [
    {
      files: [`src/features/${name}/**/*.{ts,tsx}`],
      rules: restrict(
        layer('app'),
        layer('pages'),
        layer('widgets'),
        layer('mocks'),
        otherFeatures(name),
      ),
    },
    {
      files: [`src/features/${name}/api/**/*.{ts,tsx}`],
      rules: restrict(
        layer('app'),
        layer('pages'),
        layer('widgets'),
        otherFeatures(name),
      ),
    },
  ]),
  {
    files: ['src/widgets/**/*.{ts,tsx}'],
    rules: restrict(layer('app'), layer('pages'), layer('mocks')),
  },
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: restrict(layer('app'), layer('mocks')),
  },
  {
    files: ['src/mocks/**/*.{ts,tsx}'],
    rules: restrict(layer('app'), layer('pages'), layer('widgets')),
  },
  {
    // 테스트는 조립된 앱을 띄우거나 mock을 직접 만든다. 계층 규칙에서 뺀다.
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/dev/**'],
    rules: { '@typescript-eslint/no-restricted-imports': 'off' },
  },
])
