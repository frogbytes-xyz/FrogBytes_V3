import { logger } from '@/lib/utils/logger'

/**
 * Admin Dashboard API: GitHub Tokens Management
 * GET - List all tokens
 * POST - Add new token
 * PUT - Update token
 * DELETE - Remove token
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  getAllGitHubTokens,
  addGitHubToken,
  updateGitHubToken,
  deleteGitHubToken,
  initializeTokensFromEnv
} from '@/lib/api-keys/github-token-manager'

function verifyAdminAuth(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  return apiKey === process.env.ADMIN_API_KEY
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tokens = await getAllGitHubTokens()

    // Mask token values for security
    const maskedTokens = tokens.map(token => ({
      ...token,
      token_value: `${token.token_value.substring(0, 8)}...${token.token_value.substring(token.token_value.length - 4)}`
    }))

    return NextResponse.json({
      success: true,
      data: maskedTokens
    })
  } catch (error: any) {
    logger.error('Get GitHub tokens error', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, token_name, token_value } = body

    // Special action to initialize from env
    if (action === 'initialize') {
      await initializeTokensFromEnv()
      const tokens = await getAllGitHubTokens()
      return NextResponse.json({
        success: true,
        message: 'Tokens initialized from environment variables',
        data: tokens
      })
    }

    if (!token_name || !token_value) {
      return NextResponse.json(
        { success: false, error: 'token_name and token_value are required' },
        { status: 400 }
      )
    }

    const result = await addGitHubToken(token_name, token_value)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'GitHub token added successfully'
    })
  } catch (error: any) {
    logger.error('Add GitHub token error', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!verifyAdminAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { token_id, ...updates } = body

    if (!token_id) {
      return NextResponse.json(
        { success: false, error: 'token_id is required' },
        { status: 400 }
      )
    }

    const result = await updateGitHubToken(token_id, updates)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'GitHub token updated successfully'
    })
  } catch (error: any) {
    logger.error('Update GitHub token error', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!verifyAdminAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const tokenId = searchParams.get('token_id')

    if (!tokenId) {
      return NextResponse.json(
        { success: false, error: 'token_id is required' },
        { status: 400 }
      )
    }

    const result = await deleteGitHubToken(tokenId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'GitHub token deleted successfully'
    })
  } catch (error: any) {
    logger.error('Delete GitHub token error', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
