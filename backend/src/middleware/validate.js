/**
 * Validates and normalises request parts with zod schemas.
 * Parsed values replace the raw ones, so handlers only ever see clean data.
 */
export const validate = (schemas) => (req, _res, next) => {
  try {
    for (const part of ['params', 'query', 'body']) {
      if (schemas[part]) req[part] = schemas[part].parse(req[part] ?? {});
    }
    next();
  } catch (err) {
    next(err);
  }
};
