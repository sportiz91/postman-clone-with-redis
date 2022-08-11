/*
  Instalación de Redis -> yarn add redis
*/

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const Redis = require("redis"); //importamos a redis como clase. Luego tenemos que generar una instancia (objeto)

//Podemos optar por ejecutar el método sin parámetros, o pasar un options object. Ese objeto tiene como una de sus propiedades url.
//Allí querremos configurar la URL de la production App. Es decir, si estamos usando la API en localhost que corre en nuestra máquina,
//en el default port, esto es innecesario. Tengo que tener el Redis Server corriendo en mi local machine.
//Para usar este Redis Client lo voy a utilizar tal como usaría Redis normalmente.
const redisClient = Redis.createClient();

(async () => {
  await redisClient.connect();
})();

const DEFAULT_EXPIRATION = 3600;

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors());

/*
See: https://stackoverflow.com/questions/18524125/req-query-and-req-param-in-expressjs
req.query will return a JS object after the query string is parsed.

/user?name=tom&age=55 - req.query would yield {name:"tom", age: "55"}

req.params will return parameters in the matched route. If your route is /user/:id and you make a request to /user/5 - req.params would yield {id: "5"}

req.param is a function that peels parameters out of the request. All of this can be found here.

UPDATE

If the verb is a POST and you are using bodyParser, then you should be able to get the form body in you function with req.body. That will be the parsed JS version of the POSTed form.
*/

/*
  El código de nuestra get request de abajo es lento, dado que siempre estaremos llamando a una API y además está fetcheando mucha data.
  Vamos a usar Redis para cachear la información de la Response del endpoint de abajo. Entonces, siempre que hagamos requests luego de
  Que la data haya sido cacheada, la va a obtener directo de Redis (lo cual será infinitamente más rápido).
*/
app.get("/photos", async (req, res) => {
  const albumId = req.query.albumId;

  //Con el get, quiero obtener un string. El primer parámetro será la key a obtener. El segundo parámetro será un callback con error y data como argumentos.
  //En nuestro caso puntual la data son todas las diferentes photos (pero recordemos que tendremos la data como string dado que hicimos el JSON.stringify del array).
  //Redis client para node no admite más callback como segundo parámetro del get method. Solo admite async/await syntax.
  try {
    const photos = await redisClient.get(`photos?albumId=${albumId}`);

    if (photos) {
      return res.json(JSON.parse(photos));
    }

    const { data } = await axios.get(
      "https://jsonplaceholder.typicode.com/photos",
      { params: { albumId } }
    );

    redisClient.setEx(
      `photos?albumId=${albumId}`,
      DEFAULT_EXPIRATION,
      JSON.stringify(data)
    );

    res.json(data);
  } catch (err) {
    console.error(err.message);
  }
});

app.get("/photos/:id", async (req, res) => {
  const photoId = req.params.id;

  try {
    const photoById = await redisClient.get(`photos/${photoId}`);

    if (photoById) {
      return res.json(JSON.parse(photoById));
    }

    const { data } = await axios.get(
      `https://jsonplaceholder.typicode.com/photos/${photoId}`
    );

    redisClient.setEx(
      `photos/${photoId}`,
      DEFAULT_EXPIRATION,
      JSON.stringify(data)
    );

    res.json(data);
  } catch (err) {
    console.error(err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server up and running on port: ${PORT}`);
});
