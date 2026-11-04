import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createBracket } from './domain/bracket'
import { DEFAULT_HEADER, useStore } from './store'

beforeEach(() => {
  localStorage.clear()
  act(() => {
    useStore.setState({
      mode: 'MD',
      brackets: {
        MS: createBracket(32),
        WS: createBracket(32),
        MD: createBracket(32),
        WD: createBracket(32),
        XD: createBracket(32),
      },
      header: DEFAULT_HEADER,
      customEntries: [],
      editing: null,
      notice: null,
    })
  })
})
afterEach(cleanup)

describe('App', () => {
  it('能渲染头部、模式切换和 32 个首轮位置', () => {
    const { container } = render(<App />)
    expect(screen.getByText('羽毛球对阵图编辑器')).toBeTruthy()
    expect(container.querySelector('.hl')?.textContent).toBe('男双')
    // 32+16+8+4+2+1 = 63 个位置
    expect(container.querySelectorAll('.slot')).toHaveLength(63)
  })

  it('切换模式后标题里的关键词同步变化', () => {
    const { container } = render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: '混双' }))
    expect(container.querySelector('.hl')?.textContent).toBe('混双')
  })

  it('点击位置，选择当前模式名单里的组合后显示姓名', () => {
    const { container } = render(<App />)
    fireEvent.click(container.querySelectorAll('.slot')[0])
    const search = screen.getByPlaceholderText(/搜索：中文/)
    fireEvent.change(search, { target: { value: 'jyh' } })
    fireEvent.click(screen.getByText('金元浩/徐承宰'))
    expect(container.querySelector('.slot-name')?.textContent).toBe('金元浩/徐承宰')
    expect(container.querySelector('.slot .fi-kr')).toBeTruthy()
  })

  it('选人后不会自动加种子；在弹窗里手动选择种子后才显示序号', () => {
    const { container } = render(<App />)
    fireEvent.click(container.querySelectorAll('.slot')[0])
    fireEvent.click(screen.getByText('金元浩/徐承宰'))
    expect(container.querySelector('.slot-name')?.textContent).toBe('金元浩/徐承宰')
    fireEvent.click(container.querySelectorAll('.slot')[0])
    fireEvent.change(screen.getByLabelText('种子'), { target: { value: '1' } })
    expect(container.querySelector('.slot-name')?.textContent).toBe('①金元浩/徐承宰')
  })

  it('已经放进对阵图的选手，在别的位置的下拉里标记为已选用，不能再选', () => {
    const { container } = render(<App />)
    const slots = container.querySelectorAll('.slot')
    fireEvent.click(slots[0])
    fireEvent.click(screen.getByText('金元浩/徐承宰'))

    fireEvent.click(slots[2]) // 另一个首轮位置
    const row = within(screen.getByRole('listbox')).getByText('金元浩/徐承宰').closest('li')!
    expect(row.className).toContain('used')
    fireEvent.click(row)
    expect(container.querySelectorAll('.slot-name')).toHaveLength(1) // 没有新增选手

    // 原来的位置可以重新打开并选回自己
    fireEvent.click(document.querySelector('.editor .x')!)
    fireEvent.click(slots[0])
    const rowSelf = within(screen.getByRole('listbox')).getByText('金元浩/徐承宰').closest('li')!
    expect(rowSelf.className).not.toContain('used')
  })

  it('后续轮次只能在上一轮两位选手之间选晋级者，不能选别人，并且可以随时改选', () => {
    const { container } = render(<App />)
    const slots = () => container.querySelectorAll('.slot')
    // 首轮第 1、2 位放入前两组
    fireEvent.click(slots()[0])
    fireEvent.click(screen.getByText('金元浩/徐承宰'))
    fireEvent.click(slots()[1])
    fireEvent.click(
      within(screen.getByRole('listbox')).getByText('法贾尔·阿尔菲安/穆罕默德·肖希布·菲克里'),
    )

    // 打开 16 强的第 1 个位置（下标 32）：没有搜索框，只有两个候选
    fireEvent.click(slots()[32])
    expect(screen.queryByPlaceholderText(/搜索：中文/)).toBeNull()
    const options = container.ownerDocument.querySelectorAll('.winner-option')
    expect(options).toHaveLength(2)

    fireEvent.click(options[0]) // 金元浩/徐承宰 晋级
    expect(slots()[32].querySelector('.slot-name')?.textContent).toContain('金元浩/徐承宰')

    // 改选另一位
    fireEvent.click(slots()[32])
    fireEvent.click(container.ownerDocument.querySelectorAll('.winner-option')[1])
    expect(slots()[32].querySelector('.slot-name')?.textContent).toContain('阿尔菲安')
  })

  it('各模式的对阵数据互相独立', () => {
    const { container } = render(<App />)
    fireEvent.click(container.querySelectorAll('.slot')[0])
    fireEvent.click(screen.getByText('金元浩/徐承宰'))
    fireEvent.click(screen.getByRole('tab', { name: '男单' }))
    expect(container.querySelector('.slot-name')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: '男双' }))
    expect(container.querySelector('.slot-name')?.textContent).toBe('金元浩/徐承宰')
  })
})
