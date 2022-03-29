import config from '../config'
import { User } from '../resources/user/user.model'
import jwt from 'jsonwebtoken'
import { createTypes, getTypes } from './types'

export const newToken = (user) => {
  return jwt.sign({ id: user.id }, config.secrets.jwt, {
    expiresIn: config.secrets.jwtExp,
  })
}

export const verifyToken = (token) =>
  new Promise((resolve, reject) => {
    jwt.verify(token, config.secrets.jwt, (err, payload) => {
      if (err) return reject(err)
      resolve(payload)
    })
  })

export const signUp = async (req, res) => {
  if (!req.body.email || !req.body.password) {
    return res.status(400).send({ message: 'need email and password' })
  }

  const newUser = { email: req.body.email, password: req.body.password }

  try {
    const user = await User.create(newUser)
    const types = await createTypes(user)
    const token = newToken(user)
    return res.status(201).send({ token, email: user.email, types })
  } catch (e) {
    console.error(e)
    return res.status(500).end()
  }
}

export const signIn = async (req, res) => {
  if (!req.body.email || !req.body.password) {
    return res.status(400).send({ message: 'need email and password' })
  }

  const invalid = { message: 'invalid email and password' }

  try {
    const user = await User.findOne({ email: req.body.email })
      .select('email password')
      .exec()

    if (!user) {
      return res.status(401).send(invalid)
    }

    const match = await user.checkPassword(req.body.password)

    if (!match) {
      return res.status(401).send(invalid)
    }

    const types = await getTypes(user._id)
    console.log(types)
    const token = newToken(user)
    return res.status(201).send({ token, email: user.email, types })
  } catch (e) {
    console.error(e)
    return res.status(500).end()
  }
}

export const protect = async (req, res, next) => {
  const bearer = req.headers.authorization

  if (!bearer || !bearer.startsWith('Bearer ')) {
    return res.status(401).end()
  }

  const token = bearer.split('Bearer ')[1].trim()
  let payload

  try {
    payload = await verifyToken(token)
  } catch (e) {
    return res.status(401).end()
  }

  const user = await User.findById(payload.id).select('-password').lean().exec()

  if (!user) {
    return res.status(401).end()
  }

  req.user = user
  next()
}
