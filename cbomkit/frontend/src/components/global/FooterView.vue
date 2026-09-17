<template>
  <div></div>
</template>

<script>
export default {
  name: "FooterView",
};
</script>

<style scoped>
.footer-link {
  color: white;
  padding-bottom: 12px;
  font-size: medium;
  cursor: pointer;
}
.footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}

.footer-column {
  flex: 1;
  margin: 10px;
  text-align: left;
  display: flex;
  flex-direction: column;
}

.footer-column cv-link {
  margin-bottom: 10px;
  text-decoration: none;
  color: #333;
}

@media (min-width: 900px) {
  .footer-column {
    flex-basis: calc(33.33% - 20px);
  }
}

@media (max-width: 899px) {
  .footer-column {
    flex-basis: calc(50% - 20px);
  }
}

/* Allows to modify the color of cv-links */
.bx--link:hover {
  color: lightblue;
}
.bx--link:visited:hover {
  color: lightblue;
}
.bx--link:visited {
  color: white;
}
</style>